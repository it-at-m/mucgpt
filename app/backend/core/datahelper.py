
from sqlalchemy.orm import declarative_base
from sqlalchemy import Column, Integer, String, DateTime, Text
from datetime import datetime
from sqlalchemy import create_engine
from sqlalchemy.engine import URL
from sqlalchemy.orm import Session
from sqlalchemy import func

Base = declarative_base()

class Requestinfo(Base):
    __tablename__ = 'requestinfo'

    id = Column(Integer(), primary_key=True)
    tokencount = Column(Integer())
    department = Column(String(20), nullable=False)
    messagecount = Column(Integer())
    method = Column(String(10))
    created_on = Column(DateTime(), default=datetime.now)
    updated_on = Column(DateTime(), default=datetime.now, onupdate=datetime.now)

    def __repr__(self):
        return '<ID %r, Department %r, Tokencount %r, Method %r, Messagecount %r> ' % (self.id, self.department, self.tokencount, self.method, self.messagecount)



class Repository:
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
            results = [tuple(row) for row in results]
            return results

    def avgByDepartment(self):
        with Session(self.engine) as session:
            queryResult = session.query(Requestinfo.department, func.avg(Requestinfo.tokencount)).group_by(Requestinfo.department)
            results = queryResult.all()
            results = [tuple(row) for row in results]
            return results
    
    def clear(self):
        with Session(self.engine) as session:
            session.query(Requestinfo).delete()
            session.commit()
