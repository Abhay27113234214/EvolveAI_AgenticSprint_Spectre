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
from pydantic import BaseModel, Field
from typing import Optional, Literal
from dotenv import load_dotenv
from flask import Flask ,render_template ,redirect ,url_for ,request ,flash , abort
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







# the langchain code 
load_dotenv()
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





# the cache system to boost the performance
visited_url_cache = {}






# models in the flask database
class User(db.Model):
    __tablename__ = "user"
    id = db.Column(db.Integer, primary_key = True)
    userName = db.Column(db.String(200))
    email = db.Column(db.String(150), nullable = False)
    password_hash = db.Column(db.String(256), nullable = False)
    def as_dict(self):
        return {
            "id": self.id,
            "userName": self.userName,
            "email": self.email,
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

def role_required(role):
    def wrapper(fn):
        @wraps(fn)
        def decorated_view(*args, **kwargs):
            if not current_user.is_authenticated or current_user.role == role:
                return fn(*args, **kwargs)
        return decorated_view
    return wrapper






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
        if not User.query.filter_by(role="admin").first():
            admin_user = User(id=0,userName="Admin", email="admin@gmail.com", mobile="1234567890", role="admin")
            admin_user.set_password("admin123") 
            db.session.add(admin_user)
            db.session.commit()
            print("Admin user created with email: admin@gmail.com and password: admin123")
    app.run(debug=True)