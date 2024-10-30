
import csv
import io
from datetime import datetime

from sqlalchemy import Column, DateTime, Integer, String, create_engine, func
from sqlalchemy.engine import URL
from sqlalchemy.orm import Session, declarative_base

Base = declarative_base()
DEPARTMENT_STRING_LENGTH=30
MODEL_STRING_LENGTH=20
METHOD_STRING_LENGTH=10

class Requestinfo(Base):
    """Information about an Request to MUCGPT that is stored in the database.
    """
    __tablename__ = 'requestinfo'

    id = Column(Integer(), primary_key=True)
    tokencount = Column(Integer())
    department = Column(String(DEPARTMENT_STRING_LENGTH), nullable=False)
    model = Column(String(MODEL_STRING_LENGTH), nullable=False)
    messagecount = Column(Integer())
    method = Column(String(METHOD_STRING_LENGTH))
    created_on = Column(DateTime(), default=datetime.now)
    updated_on = Column(DateTime(), default=datetime.now, onupdate=datetime.now)

    def __repr__(self):
        return f'<ID {self.id!r}, Department {self.department!r}, Tokencount {self.tokencount!r}, Model {self.model!r}, Method {self.method!r}, Messagecount {self.messagecount!r}>'




class Repository:
    """Connects to a postgresql database.
    Saves information about processed requests (Requestinfo).
    Calculates statistics.
    """
    def __init__(self, username: str, host: str, database: str, password: str):
        url = URL.create(
            drivername="postgresql",
            username=username,
            host=host,
            database=database,
            password=password
        )
        self.engine = create_engine(url)

    def setup_schema(self, base):
        base.metadata.create_all(self.engine)

    def addInfo(self, info: Requestinfo):
        info.department = self.truncate_string(info.department, DEPARTMENT_STRING_LENGTH)
        info.model = self.truncate_string(info.model, MODEL_STRING_LENGTH)
        info.method = self.truncate_string(info.method, METHOD_STRING_LENGTH)
        with Session(self.engine) as session:
            session.add(info)
            session.commit()
    def get(self, id):
         with Session(self.engine) as session:
            return session.get(Requestinfo, id)
    def getAll(self):
        with Session(self.engine) as session:
            infos_objs = session.query(Requestinfo)
            results = infos_objs.all()
            return results

    def countByDepartment(self):
        with Session(self.engine) as session:
            queryResult = session.query(Requestinfo.department, func.count(Requestinfo.tokencount)).group_by(Requestinfo.department)
            results = queryResult.all()
            results = [tuple(row) for row in results]
            return results

    def sumByDepartment(self):
        with Session(self.engine) as session:
            queryResult = session.query(Requestinfo.department, func.sum(Requestinfo.tokencount)).group_by(Requestinfo.department)
            results = queryResult.all()
            results = [{"department": row[0], "tokencount": float(row[1])} for row in results]
            return results

    def avgByDepartment(self):
        with Session(self.engine) as session:
            queryResult = session.query(Requestinfo.department, func.avg(Requestinfo.tokencount)).group_by(Requestinfo.department)
            results = queryResult.all()
            results = [{"department": row[0], "tokencount": float(row[1])} for row in results]
            return results

    def clear(self):
        with Session(self.engine) as session:
            session.query(Requestinfo).delete()
            session.commit()

    def export(self):
        memfile = io.StringIO()
        outcsv = csv.writer(memfile, delimiter=',',quotechar='"', quoting = csv.QUOTE_MINIMAL)
        outcsv.writerow([column.name for column in Requestinfo.__mapper__.columns])
        [outcsv.writerow([getattr(curr, column.name) for column in Requestinfo.__mapper__.columns]) for curr in self.getAll()]

        memfile.seek(0)
        return memfile

    def truncate_string(self, s, length):
        if len(s) > length:
            return s[:length]
        return s
