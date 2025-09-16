# import os
# from dotenv import load_dotenv
# from langchain_community.document_loaders import PyPDFLoader
# from langchain.text_splitter import RecursiveCharacterTextSplitter
# from langchain_google_genai import GoogleGenerativeAIEmbeddings, ChatGoogleGenerativeAI
# from langchain_community.vectorstores import FAISS
# from pydantic import BaseModel, Field
# from langchain_core.prompts import PromptTemplate, ChatPromptTemplate, ChatMessagePromptTemplate, MessagesPlaceholder


# load_dotenv()

# SOURCE_PDF_PATH = "C:/Users/abhay/Desktop/CFO/backend/uploads/sample_data.pdf"
# # FAISS_INDEX_PATH = "faiss_index"

# print("Starting the preprocessing script...")

# print(f"Loading PDF from: {SOURCE_PDF_PATH}")
# loader = PyPDFLoader(SOURCE_PDF_PATH)
# docs = loader.load()



# text_splitter = RecursiveCharacterTextSplitter(
#     chunk_size=1500,
#     chunk_overlap=300
# )
# print("Splitting the document into chunks...")
# chunks = text_splitter.split_documents(docs[:20])
# print(f"Document split into {len(chunks)} chunks.")


# print("Initializing embedding model...")
# embedding_model = GoogleGenerativeAIEmbeddings(model="models/text-embedding-004")

# print("\nCreating the vector store from document chunks...")
# print("This is the slow part and will make many API calls to Google.")
# print("Please be patient, this can take several minutes...\n")

# vector_store_for_TOC = FAISS.from_documents(
#     documents=chunks,
#     embedding=embedding_model
# )

# toc_retriever = vector_store_for_TOC.as_retriever(search_type='similarity', search_kwargs={'k':3})

# toc = toc_retriever.invoke("Table of Contents")

# toc_text = "\n\n".join(document.page_content for document in toc)

# class PageRange(BaseModel):
#     """Defines the start and end page for a document section."""
#     start_page: int = Field(description="The page number where the section begins.")
#     end_page: int = Field(description="The page number where the section ends.")

# class DocumentMap(BaseModel):
#     """A structured map of key financial statement sections in the report."""
#     consolidated_profit_loss: PageRange
#     consolidated_balance_sheet: PageRange
#     consolidated_cash_flow: PageRange

# document_navigator_prompt = PromptTemplate(
#     template="""
#         You are an expert document analyst. Your task is to find the STARTING and ENDING page numbers for the key financial statements based on the provided Table of Contents.

#         A statement section ends where the next major section begins. Based ONLY on the CONTEXT below, find the page ranges and populate the JSON object according to the schema.

#         CONTEXT:
#         {table_of_contents_text}
#     """,
#     input_variables=['table_of_contents_text']
# )

# model = ChatGoogleGenerativeAI(model='gemini-1.5-flash')
# document_mapping_model = model.with_structured_output(DocumentMap)

# document_mapping_chain = document_navigator_prompt | document_mapping_model

# print(document_mapping_chain.invoke({'table_of_contents_text':toc_text}))

# # --- 3. SAVE THE VECTOR STORE LOCALLY ---
# print(f"Saving the vector store to local path: {FAISS_INDEX_PATH}")
# vector_store.save_local(FAISS_INDEX_PATH)

# # print("\nPreprocessing complete!")
# print(f"Vector store has been created and saved in the '{FAISS_INDEX_PATH}' folder.")
# # print("You can now run your Flask app.")


































import os
from dotenv import load_dotenv
from langchain_community.document_loaders import PyPDFLoader
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from langchain_community.vectorstores import FAISS

load_dotenv()

SOURCE_PDF_PATH = "C:/Users/abhay/Documents/GitHub/EvolveAI_AgenticSprint_Spectre/CFO/backend/uploads/sample_data.pdf" 
FAISS_INDEX_PATH = "C:/Users/abhay/Documents/GitHub/EvolveAI_AgenticSprint_Spectre/CFO/backend/faiss_index"

def create_vector_store():
    
    print(f"Loading PDF from: {SOURCE_PDF_PATH}")
    loader = PyPDFLoader(SOURCE_PDF_PATH)
    docs = loader.load()

    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=1500,
        chunk_overlap=300
    )
    
    print("Splitting the document into chunks...")
    chunks = text_splitter.split_documents(docs)
    print(f"Document split into {len(chunks)} chunks.")

    print("Initializing embedding model...")
    embedding_model = GoogleGenerativeAIEmbeddings(model="models/text-embedding-004")

    print("\nCreating the vector store. This will take several minutes...")
    vector_store = FAISS.from_documents(
        documents=chunks,
        embedding=embedding_model
    )
    
    print(f"Saving the vector store to the folder: '{FAISS_INDEX_PATH}'")
    vector_store.save_local(FAISS_INDEX_PATH)
    print("Vector store saved successfully.")


if __name__ == "__main__":
    create_vector_store()