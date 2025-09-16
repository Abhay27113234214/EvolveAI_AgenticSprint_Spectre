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
ALLOWED_EXTENSIONS = {'pdf'}
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

# The Python function for reliable math
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
        # Handles raw numbers like 95,000; assumes it's not in crores
        if value > 100000: # Heuristic: large raw numbers are likely not crores
             return value / 10000000.0
    
    return value # Assumes the unit is 'crore' or a raw number already in crores




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
    return render_template("home.html")


@app.route("/upload_annual_report", methods=['POST'])
def uploadAnnualPdf():
    if 'pdf_file' not in request.files:
        flash('No files passed!', "danger")
        return redirect(url_for('uploadAnnualPdf'))

    file = request.files['pdf_file']
    
    if file.filename == "":
        flash('No File selected', 'danger')
        return redirect(url_for('uploadAnnualPdf'))
    
    if file and allowed_file(file.filename):
        filename = secure_filename(file.filename)
        save_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(save_path)
        session['uploaded_file_path'] = save_path
        flash("file upload Successfull!", "success")
        return redirect(url_for("dashboard"))
    else:
        flash("File upload Not Successfull!", "danger")
        return "invlaid file type. Only pdfs are allowed."



@app.route("/dashboard")
@login_required
def dashboard():

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
        "total_liabilities": "What is the value for 'Total liabilities' on the CONSOLIDATED Balance Sheet for the current year?",
        "cash_reserves": "What is the 'CONSOLIDATED cash balance' as of the end of the current fiscal year?",
        "net_cash_from_operations": "What is the value for 'Net cash generated from / (used in) operating activities' for the current fiscal year?"
    }

    print(current_user.company_name)
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
    return jsonify(final_data.dict())
   











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