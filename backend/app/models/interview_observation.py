"""
Recruiter observations recorded during an interactive coding interview.
"""

from sqlalchemy import Column, Integer, Text, String, DateTime, ForeignKey, func
from sqlalchemy.orm import relationship

from app.database.session import Base


class InterviewObservation(Base):
    __tablename__ = "interview_observations"

    id = Column(Integer, primary_key=True, index=True)

    interview_id = Column(
        Integer,
        ForeignKey("interviews.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Recruiter who created the observation
    examiner_id = Column(
        Integer,
        ForeignKey("examiners.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    category = Column(
        String(50),
        nullable=False,
    )

    note = Column(
        Text,
        nullable=False,
    )

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    interview = relationship(
        "Interview",
        back_populates="observations",
    )

    examiner = relationship("Examiner")