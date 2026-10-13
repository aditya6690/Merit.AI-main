"""
Interactive coding interview model.

An Interview connects one Examiner (recruiter) with one Student (candidate)
for a live technical coding interview.
"""

from sqlalchemy import Column, Integer, String, Text, ForeignKey, DateTime, func
from sqlalchemy.orm import relationship

from app.database.session import Base
from app.models.enums import InterviewStatus, db_enum


class Interview(Base):
    __tablename__ = "interviews"

    id = Column(Integer, primary_key=True, index=True)

    # Recruiter / interviewer
    examiner_id = Column(
        Integer,
        ForeignKey("examiners.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Candidate
    student_id = Column(
        Integer,
        ForeignKey("students.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Organization tenancy
    organization_id = Column(
        Integer,
        ForeignKey("organizations.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )

    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)

    status = Column(
        db_enum(InterviewStatus),
        default=InterviewStatus.DRAFT,
        nullable=False,
        index=True,
    )

    # Scheduled interview time
    scheduled_at = Column(DateTime(timezone=True), nullable=True)

    # Server-controlled interview lifecycle
    started_at = Column(DateTime(timezone=True), nullable=True)
    ended_at = Column(DateTime(timezone=True), nullable=True)

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    # Relationships
    examiner = relationship("Examiner")
    student = relationship("Student")
    organization = relationship("Organization")

    questions = relationship(
        "InterviewQuestion",
        back_populates="interview",
        cascade="all, delete-orphan",
        order_by="InterviewQuestion.order_index",
    )

    observations = relationship(
        "InterviewObservation",
        back_populates="interview",
        cascade="all, delete-orphan",
        order_by="InterviewObservation.created_at",
    )

    evaluation = relationship(
        "InterviewEvaluation",
        back_populates="interview",
        uselist=False,
        cascade="all, delete-orphan",
    )