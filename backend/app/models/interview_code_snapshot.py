"""
Saved code snapshots for interactive coding interviews.

Snapshots are persisted periodically and at important interview events
instead of storing every individual keystroke.
"""

from sqlalchemy import Column, Integer, Text, String, DateTime, ForeignKey, func
from sqlalchemy.orm import relationship

from app.database.session import Base


class InterviewCodeSnapshot(Base):
    __tablename__ = "interview_code_snapshots"

    id = Column(Integer, primary_key=True, index=True)

    interview_id = Column(
        Integer,
        ForeignKey("interviews.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    question_id = Column(
        Integer,
        ForeignKey("questions.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    # The language used for this snapshot.
    language = Column(
        String(30),
        nullable=False,
    )

    # Candidate's source code at this point in the interview.
    code = Column(
        Text,
        nullable=False,
    )

    # Version increases whenever a persisted snapshot is created.
    version = Column(
        Integer,
        nullable=False,
        default=1,
    )

    # Why this snapshot was persisted:
    # periodic, run, question_change, pause, complete, reconnect, etc.
    reason = Column(
        String(50),
        nullable=False,
        default="periodic",
    )

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    interview = relationship("Interview")

    question = relationship("Question")