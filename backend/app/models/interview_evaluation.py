"""
Structured recruiter evaluation for an interactive coding interview.
"""

from sqlalchemy import Column, Integer, Text, String, DateTime, ForeignKey, Float, func
from sqlalchemy.orm import relationship

from app.database.session import Base


class InterviewEvaluation(Base):
    __tablename__ = "interview_evaluations"

    id = Column(Integer, primary_key=True, index=True)

    interview_id = Column(
        Integer,
        ForeignKey("interviews.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )

    examiner_id = Column(
        Integer,
        ForeignKey("examiners.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Structured scoring
    problem_solving_score = Column(Float, nullable=True)
    technical_knowledge_score = Column(Float, nullable=True)
    code_quality_score = Column(Float, nullable=True)
    communication_score = Column(Float, nullable=True)
    debugging_score = Column(Float, nullable=True)

    overall_score = Column(Float, nullable=True)

    strengths = Column(Text, nullable=True)
    weaknesses = Column(Text, nullable=True)
    overall_feedback = Column(Text, nullable=True)

    # Recruiter's final interview outcome
    recommendation = Column(
        String(50),
        nullable=True,
    )

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    interview = relationship(
        "Interview",
        back_populates="evaluation",
    )

    examiner = relationship("Examiner")