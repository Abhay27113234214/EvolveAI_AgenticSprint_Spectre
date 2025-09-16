# from langchain_huggingface import HuggingFaceEndpoint, HuggingFaceEmbeddings, ChatHuggingFace, HuggingFacePipeline
# from langchain_ollama import ChatOllama, OllamaEmbeddings
from langchain_core.output_parsers import StrOutputParser, PydanticOutputParser
from langchain_core.prompts import PromptTemplate, ChatPromptTemplate, ChatMessagePromptTemplate, MessagesPlaceholder
from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
from langchain_community.document_loaders import WebBaseLoader, PyPDFLoader
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_community.vectorstores import FAISS
from langchain_core.documents import Document
from langchain_core.runnables import RunnableParallel, RunnablePassthrough, RunnableLambda
from langchain_google_genai import ChatGoogleGenerativeAI, GoogleGenerativeAIEmbeddings
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_community.vectorstores import FAISS
from langchain.retrievers.multi_query import MultiQueryRetriever
from pydantic import BaseModel, Field
from typing import Optional, Literal
from dotenv import load_dotenv
from flask import Flask ,render_template ,redirect ,url_for ,request ,flash , abort, session
from flask_sqlalchemy import SQLAlchemy
from flask_bcrypt import Bcrypt
from functools import wraps
from datetime import datetime
from flask_restful import Api, Resource
from flask_jwt_extended import JWTManager, create_access_token, jwt_required, get_jwt_identity
from flask_restful import Api
from flask_login import LoginManager,UserMixin,login_required, login_user, logout_user, current_user
from flask import jsonify
from datetime import datetime
from flask_cors import CORS
from werkzeug.utils import secure_filename
import os
import numpy as np
import pandas as pd






# flask setup
jwt = JWTManager()
app = Flask(__name__, static_folder="static")
jwt.init_app(app)
cors = CORS(app, resources={r"/api/*": {"origins": "*"}})
api = Api(app)
app.config["JWT_SECRET_KEY"] = "super-secret"
basedir=os.path.abspath(os.path.dirname(__file__))
app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///" + os.path.join(basedir,"app.db")
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
app.config['SECRET_KEY'] = 'projectbangayaapna'
bcrypt = Bcrypt(app)
db = SQLAlchemy(app)
UPLOAD_FOLDER = 'uploads'
ALLOWED_EXTENSIONS = {'pdf', 'xls', 'xlsx'}
app.config['UPLOAD_FOLDER'] = os.path.join(basedir, UPLOAD_FOLDER)
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS
login_manager = LoginManager()
login_manager.init_app(app)
@login_manager.user_loader
def load_user(user_id):
    return db.session.get(User, int(user_id))







# the langchain code 
load_dotenv()
FAISS_INDEX_PATH = "C:/Users/abhay/Desktop/CFO/backend/faiss_index"
model = ChatGoogleGenerativeAI(model='gemini-1.5-flash')
class FinancialReportData(BaseModel):
    company_name: str = Field(description="Name of the company")
    fiscal_year: str = Field(description="The fiscal year of the report, e.g., 'FY24'")
    revenue_current_year: float = Field(description="Revenue from operations for the current fiscal year in crores.")
    revenue_previous_year: float = Field(description="Revenue from operations for the previous fiscal year in crores.")
    profit_after_tax_current_year: float = Field(description="Profit or Loss for the current year in crores.")
    profit_after_tax_previous_year: float = Field(description="Profit or Loss for the previous year in crores.")
    total_liabilities: float = Field(description="Sum of current and non-current liabilities in crores.")
    cash_reserves: float = Field(description="The consolidated cash balance in crores.")
    net_cash_from_operations: float = Field(description="Net cash generated from or used in operating activities in crores.")
    total_current_assets: float = Field(description="The value for the 'Total current assets' line item from the Consolidated Balance Sheet.")
    total_current_liabilities: float = Field(description="The value for the 'Total current liabilities' line item from the Consolidated Balance Sheet.")
    total_equity: float = Field(description="The value for the 'Total equity' line item from the Consolidated Balance Sheet.")

recursive_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
def format_docs(retrieved_docs):
    context_text = "\n\n".join([doc.page_content for doc in retrieved_docs])
    return context_text
embedding_model = GoogleGenerativeAIEmbeddings(model='text-embedding-004')
populate_pydantic_model_prompt = PromptTemplate(
    template="""
        ## ROLE
        You are an expert financial data extraction system. Your purpose is to read a given text context and accurately extract specific financial figures.

        ---
        ## TASK
        Your task is to populate a JSON object that strictly adheres to the provided JSON schema. You must find the correct values for each field from the **CONTEXT** below and place them into the corresponding fields of the JSON object.

        ---
        ## CONSTRAINTS
        - **STRICTLY use ONLY the information present in the CONTEXT provided.** Do not use any external knowledge or make assumptions.
        - If a specific value for a field is not found in the CONTEXT, you **MUST** use a `null` value for that field. Do not try to calculate or infer missing data.
        - Extract only the numerical values. For example, if the text says "₹12,114 crore", you must extract the number `12114`.
        - Pay close attention to the fiscal years. Ensure the data for "current_year" and "previous_year" are from the correct periods mentioned in the context.

        ---
        ## CONTEXT
        {final_context_from_rag}
    """,
    input_variables=['final_context_from_rag']
)
structured_model = model.with_structured_output(FinancialReportData)
str_parser = StrOutputParser()
class ExtractedValue(BaseModel):
    """A model to capture a numerical value and its associated unit."""
    value: float = Field(description="The numerical value extracted from the text, ignoring commas.")
    unit: Literal['crore', 'lakh', 'thousand', 'none'] = Field(description="The unit associated with the value. If no unit, use 'none'.")

def normalize_to_crore(extracted_data: ExtractedValue) -> float:
    """Converts an ExtractedValue object to a float in crores."""
    if not extracted_data or extracted_data.value is None:
        return 0.0

    value = extracted_data.value
    unit = extracted_data.unit

    if unit == 'lakh':
        return value / 100.0
    elif unit == 'thousand':
        return value / 100000.0
    elif unit == 'none':
        if value > 100000: 
             return value / 10000000.0
    
    return value


class FinancialDataLocationMap(BaseModel):
    """
    A structured map that links each financial metric to the specific Excel sheet
    where its data can be found.
    """
    company_name: Optional[str] = Field(description="The name of the sheet containing the company's name (e.g., 'Cover Page', 'Summary').")
    fiscal_year: Optional[str] = Field(description="The name of the sheet containing the fiscal year (e.g., 'Cover Page', 'Summary').")
    
    revenue_current_year: Optional[str] = Field(description="The name of the sheet containing the Profit and Loss or Income Statement.")
    revenue_previous_year: Optional[str] = Field(description="The name of the sheet containing the Profit and Loss or Income Statement.")
    profit_after_tax_current_year: Optional[str] = Field(description="The name of the sheet containing the Profit and Loss or Income Statement.")
    profit_after_tax_previous_year: Optional[str] = Field(description="The name of the sheet containing the Profit and Loss or Income Statement.")
    
    total_liabilities: Optional[str] = Field(description="The name of the sheet containing the Balance Sheet.")
    total_current_assets: Optional[str] = Field(description="The name of the sheet containing the Balance Sheet.")
    total_current_liabilities: Optional[str] = Field(description="The name of the sheet containing the Balance Sheet.")
    total_equity: Optional[str] = Field(description="The name of the sheet containing the Balance Sheet.")

    cash_reserves: Optional[str] = Field(description="The name of the sheet containing the high-level cash balance (e.g., 'Summary', 'Highlights', or 'Balance Sheet').")
    net_cash_from_operations: Optional[str] = Field(description="The name of the sheet containing the Cash Flow Statement.")







# financial shit 
def calculate_kpis(data: FinancialReportData) -> dict:
    kpis = {}

    if data.revenue_previous_year > 0:
        growth = ((data.revenue_current_year - data.revenue_previous_year) / data.revenue_previous_year) * 100
        kpis['revenue_growth_percent'] = round(growth, 2)
    else:
        kpis['revenue_growth_percent'] = None

    if data.revenue_current_year > 0:
        margin = (data.profit_after_tax_current_year / data.revenue_current_year) * 100
        kpis['profit_margin_percent'] = round(margin, 2)
    else:
        kpis['profit_margin_percent'] = None

    monthly_cash_flow = data.net_cash_from_operations / 12
    kpis['monthly_net_cash_flow'] = round(monthly_cash_flow, 2)
    if monthly_cash_flow < 0:
        kpis['monthly_burn_rate'] = abs(round(monthly_cash_flow, 2))
    else:
        kpis['monthly_burn_rate'] = 0 


    if kpis['monthly_burn_rate'] > 0:
        runway = data.cash_reserves / kpis['monthly_burn_rate']
        kpis['runway_months'] = round(runway, 2)
    else:
        kpis['runway_months'] = float('inf') 

    if data.total_current_liabilities > 0:
        current_ratio = data.total_current_assets / data.total_current_liabilities
        kpis['current_ratio'] = round(current_ratio, 2)
    else:
        kpis['current_ratio'] = None


    if data.total_equity is not None and data.total_equity != 0:
        debt_to_equity = data.total_liabilities / data.total_equity
        kpis['debt_to_equity_ratio'] = round(debt_to_equity, 2)
    else:
        kpis['debt_to_equity_ratio'] = None

    if data.total_equity is not None and data.total_equity != 0:
        roe = (data.profit_after_tax_current_year / data.total_equity) * 100
        kpis['return_on_equity_percent'] = round(roe, 2)
    else:
        kpis['return_on_equity_percent'] = None
        
    return kpis




# models in the flask database
class User(db.Model, UserMixin):
    __tablename__ = "user"
    id = db.Column(db.Integer, primary_key = True)
    full_name = db.Column(db.String(200))
    work_email = db.Column(db.String(150), nullable = False)
    job_title = db.Column(db.String(150), nullable = True)
    company_name = db.Column(db.String(150), nullable = True)
    password_hash = db.Column(db.String(256), nullable = False)
    def as_dict(self):
        return {
            "id": self.id,
            "full_name": self.full_name,
            "email": self.work_email,
        }
    def set_password(self, password):
        self.password_hash = bcrypt.generate_password_hash(password)
    def check_password(self, password):
        return bcrypt.check_password_hash(self.password_hash, password)


class ChatMessage(db.Model):
    __tablename__ = 'chat_message'
    id = db.Column(db.Integer, primary_key = True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    is_user_message = db.Column(db.Boolean, default=False)
    message = db.Column(db.String(2000))
    timestamp = db.Column(db.DateTime, default = datetime.utcnow)






# routes 
@app.route("/")
def index():
    return render_template("index.html")


@app.route("/register", methods=["POST", "GET"])
def register():
    if request.method =="POST":
        full_name = request.form.get('full_name')
        work_email = request.form.get('work_email')
        job_title = request.form.get('job_title')
        company_name = request.form.get('comapny_name')
        password = request.form.get('password')

        if User.query.filter_by(work_email=work_email).first():
            flash("User already exists. Try logging in instead!", "danger")
            return redirect(url_for("login"))


        new_user = User(
                full_name = full_name,
                work_email = work_email,
                job_title = job_title,
                company_name=company_name
            )
        new_user.set_password(password)
        db.session.add(new_user)
        db.session.commit()

        flash("Registeration Successfull! Please login.", "success")
        return redirect(url_for("login"))
    
    return render_template("register.html")




@app.route("/login", methods=["POST", "GET"])
def login():
    if request.method == "POST":
        work_email = request.form.get("work_email")
        password = request.form.get("password")
        job_title = request.form.get("job_title")
        user = User.query.filter_by(work_email = work_email, job_title = job_title).first()
        if user and user.check_password(password):
            login_user(user)
            flash("Login successful!", "success")
            return redirect(url_for('home'))
        else:
            flash("Invalid credentials!", "danger")
            return redirect(url_for("register"))  
    return render_template("login.html")


@app.route("/home") 
@login_required
def home():
    return render_template('home.html')


@app.route("/upload_annual_report", methods=['POST'])
@login_required
def uploadAnnualReport():
    if 'report_file' not in request.files:
        flash('No files passed!', "danger")
        return redirect(url_for('home'))

    file = request.files['report_file']
    
    if file.filename == "":
        flash('No File selected', 'danger')
        return redirect(url_for('home'))
    
    if file and allowed_file(file.filename):
        filename = secure_filename(file.filename)
        save_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(save_path)
        session['uploaded_file_path'] = save_path
        flash("file upload Successfull!", "success")
        return redirect(url_for("dashboard"))
    else:
        flash("File upload Not Successfull!", "danger")
        return "invlaid file type."



@app.route("/dashboard", methods=['POST','GET'])
@login_required
def dashboard():
    file_path = session.get('uploaded_file_path')
    if file_path.endswith('.pdf'):
        print("Loading pre-built FAISS index...")
        vector_store = FAISS.load_local(
            FAISS_INDEX_PATH,
            embedding_model,
            allow_dangerous_deserialization=True
        )
        retriever = vector_store.as_retriever(search_kwargs={'k': 5})
        print("Index loaded successfully.")

        questions = {
            "fiscal_year": "What is the fiscal year mentioned on the cover of the Annual Report?",
            "revenue_current_year": "What is the 'Revenue from operations' for the current fiscal year (FY24)?",
            "revenue_previous_year": "What is the 'Revenue from operations' for the previous fiscal year (FY23)?",
            "profit_after_tax_current_year": "What is the 'Profit / (loss) for the year' for the current fiscal year (FY24)?",
            "profit_after_tax_previous_year": "What is the 'Profit / (loss) for the year' for the previous fiscal year (FY23)?",
            "total_liabilities": "What is the value for 'Total liabilities' on the CONSOLIDATED Balance Sheet in the CONSOLIDATED FINANCIAL STATEMENT for the current year?",
            "cash_reserves": "What is the 'CONSOLIDATED cash balance' in the CONSOLIDATED FINANCIAL STATEMENT as of the end of the current fiscal year?",
            "net_cash_from_operations": "What is the value for 'Net cash generated from / (used in) operating activities' for the current fiscal year?",
            "total_current_assets": "What is the value for 'Total current assets' on the Consolidated Balance Sheet for the current fiscal year?",
            "total_current_liabilities": "What is the value for 'Total current liabilities' on the Consolidated Balance Sheet for the current fiscal year?",
            "total_equity":"What is the value for 'Total equity' on the Consolidated Balance Sheet for the current fiscal year?"
        }

        extracted_answers = {"company_name": str(current_user.company_name)}
        
        extraction_model = model.with_structured_output(ExtractedValue)
        extraction_prompt = PromptTemplate.from_template(
            """Based ONLY on the following CONTEXT, extract the value and unit for the requested metric.
            - Pay close attention to words like "loss" or numbers in parentheses like (971). These indicate a negative number, and you MUST return a negative value (e.g., -971).

            CONTEXT:
            {context}
            
            METRIC:
            {question}
            """
        )
        extraction_chain = extraction_prompt | extraction_model

        for key, question in questions.items():
            print(f"Processing: {key}...")
            
            if key in [ "fiscal_year"]:
                retrieved_docs = retriever.invoke(question)
                context_string = format_docs(retrieved_docs)
                simple_chain = PromptTemplate.from_template("From the context: {context}, answer the question: {question}. Respond with only the answer.") | model | StrOutputParser()
                answer = simple_chain.invoke({"context": context_string, "question": question})
                extracted_answers[key] = answer
                print(f"  -> Raw Text Answer: '{answer}'")
                continue

            retrieved_docs = retriever.invoke(question)
            context_string = format_docs(retrieved_docs)
            
            raw_extracted_data = extraction_chain.invoke({
                "context": context_string,
                "question": question
            })
            print(f"  -> Raw Extracted Data: {raw_extracted_data}")
            
            normalized_value = normalize_to_crore(raw_extracted_data)
            print(f"  -> Normalized Value (in Crores): {normalized_value}")
            
            extracted_answers[key] = normalized_value

        final_data = FinancialReportData(**extracted_answers)

        kpis = calculate_kpis(final_data)

        result = model.invoke(f"{kpis} these are some of the financial calculations that for a company annually, explain where the company stands financially and if there any risks or improvements that the company can do to imporve their stand financially.")
        print(result.content)
        return result.content
    
    elif file_path.endswith('.xlsx') or file_path.endswith('.xls'):
        xls = pd.ExcelFile(file_path)
        sheet_names = xls.sheet_names


        questions = {
            "fiscal_year": "What is the fiscal year mentioned on the cover of the Annual Report?",
            "revenue_current_year": "What is the 'Revenue from operations' for the current fiscal year (FY24)?",
            "revenue_previous_year": "What is the 'Revenue from operations' for the previous fiscal year (FY23)?",
            "profit_after_tax_current_year": "What is the 'Profit / (loss) for the year' for the current fiscal year (FY24)?",
            "profit_after_tax_previous_year": "What is the 'Profit / (loss) for the year' for the previous fiscal year (FY23)?",
            "total_liabilities": "What is the value for 'Total liabilities' on the CONSOLIDATED Balance Sheet in the CONSOLIDATED FINANCIAL STATEMENT for the current year?",
            "cash_reserves": "What is the 'CONSOLIDATED cash balance' in the CONSOLIDATED FINANCIAL STATEMENT as of the end of the current fiscal year?",
            "net_cash_from_operations": "What is the value for 'Net cash generated from / (used in) operating activities' for the current fiscal year?",
            "total_current_assets": "What is the value for 'Total current assets' on the Consolidated Balance Sheet for the current fiscal year?",
            "total_current_liabilities": "What is the value for 'Total current liabilities' on the Consolidated Balance Sheet for the current fiscal year?",
            "total_equity":"What is the value for 'Total equity' on the Consolidated Balance Sheet for the current fiscal year?"
        }

        mapping_prompt = PromptTemplate.from_template(
            """
                You are an expert financial document analyst. Your primary task is to create a structural map of an Excel workbook.

                Analyze the provided list of sheet names . For **each financial metric** listed in the JSON schema, determine which sheet is the most likely source for that information.

                **Instructions:**
                - Group related metrics. For example, all revenue and profit figures will be on the same "Profit & Loss" sheet. All assets, liabilities, and equity figures will be on the same "Balance Sheet".
                - If you cannot confidently determine the location for a metric based on the provided context (e.g., the names and content are generic like 'Sheet1'), you MUST use `null` for that field.

                **CONTEXT FROM WORKBOOK:**
                {sheet_names}
           """
        )
        mapping_model = model.with_structured_output(FinancialDataLocationMap)
        mapping_chain = mapping_prompt | mapping_model
        ai_generated_map = mapping_chain.invoke({"sheet_names": sheet_names})
        ai_generated_map = ai_generated_map.model_dump()

        print(ai_generated_map)

        extracted_excel_ans = {}
        excel_metric_prompt = PromptTemplate.from_template(
            """
            You are a precise data extraction bot specializing in parsing CSV data from financial tables. Your task is to find a single metric.

            **Instructions:**
            1.  First, analyze the column headers in the CSV CONTEXT to determine the overall unit for the data (e.g., 'in Crores', 'in Thousands', 'in Lakhs').
            2.  Next, find the specific **METRIC TO FIND** in the first column.
            3.  Locate the value for that metric in the correct year's column.
            4.  Extract the numerical value and the overall unit you identified in step 1.
            5.  Pay close attention to negative numbers, often in parentheses like (971).
            6.  If the metric cannot be found, return null for both value and unit.

            **CSV CONTEXT:**
            {sheet_context}

            **METRIC TO FIND:**
            {metric_to_find}
            """
        )
        extraction_model = model.with_structured_output(ExtractedValue)
        excel_chain = excel_metric_prompt | extraction_model
        for key in ai_generated_map:

            if key=='company_name':
                extracted_excel_ans[key] = str(current_user.company_name)
                continue

            sheet_name_to_process = ai_generated_map.get(key)
            if not sheet_name_to_process:
                print(f"AI could not map a sheet for '{key}'. Skipping.")
                extracted_excel_ans[key] = None
                continue

            df = pd.read_excel(file_path, sheet_name=ai_generated_map[key])
            csv_for_sheet = df.to_csv(index=False)

            raw_data = excel_chain.invoke({'sheet_context':csv_for_sheet, "metric_to_find":questions[key]})

            normalized_value = normalize_to_crore(raw_data)
            extracted_excel_ans[key] = normalized_value
        
        final_data = FinancialReportData(**extracted_excel_ans)
        kpis = calculate_kpis(final_data)

        result = model.invoke(f"{kpis} these are some of the financial calculations that for a company annually, explain where the company stands financially and if there any risks or improvements that the company can do to imporve their stand financially.")
        print(result.content)
        return result.content



        
   










# api resources 
class userRegisterResource(Resource):
    def post(self):
        data = request.get_json()
        username = data.get('username')
        email = data.get('email')
        password = data.get('password')
        if User.query.filter_by(email=email).first():
            return {'message':'User already exists. Try Logging in'}, 400
        if username and email and password:
            new_user = User(
                userName=username,
                email=email
            )
            new_user.set_password(password)
            db.session.add(new_user)
            db.session.commit()
            return {'message':'User registered successfully'}, 201
        else:
            return {'message':'error'}, 400


class userLoginResource(Resource):
    def post(self):
        data = request.get_json()
        email = data.get('email')
        password = data.get('password')
        user = User.query.filter_by(email=email).first()
        if user and user.check_password(password):
            access_token = create_access_token(identity=user.email)
            return {'access_token':access_token}, 200   
        return {'message':'Invalid Credentials'}


class GetQueryResource(Resource):
    @jwt_required() 
    def post(self):
        identity = get_jwt_identity()
        user = User.query.filter_by(email=identity).first()
        chat_messages = ChatMessage.query.filter_by(user_id=user.id).order_by(ChatMessage.timestamp).all()
        chat_history_for_chain = []
        for msg in chat_messages:
            if msg.is_user_message:
                chat_history_for_chain.append(HumanMessage(content=msg.message))
            else:
                chat_history_for_chain.append(AIMessage(content=msg.message))
        data = request.get_json()
        query = data.get('query')
        result = model.invoke(query)
        return result.content

class UploadAnnualReportPdf(Resource):
    # @jwt_required()
    def post(self):
        if 'pdf_file' not in request.files:
            return 'No files passed!'

        file = request.files['pdf_file']
        
        if file.filename == "":
            return 'No file selected!'
        
        if file and allowed_file(file.filename):
            filename = secure_filename(file.filename)
            save_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
            file.save(save_path)
            return f"File {filename} uploaded successfully!"
        else:
            return "invlaid file type. Only pdfs are allowed."






# api endpoints  
api.add_resource(GetQueryResource, '/api/query')
api.add_resource(userRegisterResource, '/api/user/register')
api.add_resource(userLoginResource, '/api/user/login')
api.add_resource(UploadAnnualReportPdf, '/api/uploadAnnualReportPdf')






# for running the app
if __name__ == '__main__':
    with app.app_context():
        db.create_all()
        if not User.query.filter_by(work_email="admin@gmail.com").first():
            admin_user = User(id=0,full_name="Admin", work_email="admin@gmail.com", job_title="admin")
            admin_user.set_password("admin123") 
            db.session.add(admin_user)
            db.session.commit()
            print("Admin user created with email: admin@gmail.com and password: admin123")
    app.run(debug=True)