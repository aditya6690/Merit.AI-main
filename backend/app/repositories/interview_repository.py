"""Data access for interactive coding interviews."""

from sqlalchemy.orm import Session, joinedload

from app.models.interview import Interview
from app.models.interview_question import InterviewQuestion
from app.models.interview_observation import InterviewObservation
from app.models.interview_evaluation import InterviewEvaluation
from app.models.interview_code_snapshot import InterviewCodeSnapshot


def create_interview(db: Session, data: dict) -> Interview:
    interview = Interview(**data)
    db.add(interview)
    db.commit()
    db.refresh(interview)
    return interview


def get_interview(db: Session, interview_id: int) -> Interview | None:
    return (
        db.query(Interview)
        .options(
            joinedload(Interview.questions)
            .joinedload(InterviewQuestion.question),
            joinedload(Interview.observations),
            joinedload(Interview.evaluation),
        )
        .filter(Interview.id == interview_id)
        .first()
    )


def list_interviews_for_examiner(
    db: Session,
    examiner_id: int,
) -> list[Interview]:
    return (
        db.query(Interview)
        .filter(Interview.examiner_id == examiner_id)
        .order_by(Interview.created_at.desc())
        .all()
    )


def list_interviews_for_student(
    db: Session,
    student_id: int,
) -> list[Interview]:
    return (
        db.query(Interview)
        .filter(Interview.student_id == student_id)
        .order_by(Interview.created_at.desc())
        .all()
    )


def add_question(
    db: Session,
    interview_id: int,
    question_id: int,
    order_index: int,
) -> InterviewQuestion:
    item = InterviewQuestion(
        interview_id=interview_id,
        question_id=question_id,
        order_index=order_index,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


def get_interview_question(
    db: Session,
    interview_question_id: int,
) -> InterviewQuestion | None:
    return (
        db.query(InterviewQuestion)
        .filter(InterviewQuestion.id == interview_question_id)
        .first()
    )


def add_observation(
    db: Session,
    interview_id: int,
    examiner_id: int,
    category: str,
    note: str,
) -> InterviewObservation:
    observation = InterviewObservation(
        interview_id=interview_id,
        examiner_id=examiner_id,
        category=category.strip(),
        note=note.strip(),
    )
    db.add(observation)
    db.commit()
    db.refresh(observation)
    return observation


def save_code_snapshot(
    db: Session,
    interview_id: int,
    question_id: int,
    language: str,
    code: str,
    reason: str,
) -> InterviewCodeSnapshot:
    latest_snapshot = (
        db.query(InterviewCodeSnapshot)
        .filter(
            InterviewCodeSnapshot.interview_id == interview_id,
            InterviewCodeSnapshot.question_id == question_id,
        )
        .order_by(
            InterviewCodeSnapshot.version.desc()
        )
        .first()
    )

    next_version = (
        latest_snapshot.version + 1
        if latest_snapshot
        else 1
    )

    snapshot = InterviewCodeSnapshot(
        interview_id=interview_id,
        question_id=question_id,
        language=language,
        code=code,
        version=next_version,
        reason=reason,
    )

    db.add(snapshot)
    db.commit()
    db.refresh(snapshot)

    return snapshot

def get_code_snapshots(
    db: Session,
    interview_id: int,
) -> list[InterviewCodeSnapshot]:
    return (
        db.query(InterviewCodeSnapshot)
        .filter(
            InterviewCodeSnapshot.interview_id == interview_id
        )
        .order_by(
            InterviewCodeSnapshot.version.asc(),
            InterviewCodeSnapshot.created_at.asc(),
        )
        .all()
    )

def get_evaluation(
    db: Session,
    interview_id: int,
) -> InterviewEvaluation | None:
    return (
        db.query(InterviewEvaluation)
        .filter(InterviewEvaluation.interview_id == interview_id)
        .first()
    )


def create_or_update_evaluation(
    db: Session,
    interview_id: int,
    examiner_id: int,
    data: dict,
) -> InterviewEvaluation:
    evaluation = get_evaluation(db, interview_id)

    if evaluation is None:
        evaluation = InterviewEvaluation(
            interview_id=interview_id,
            examiner_id=examiner_id,
        )
        db.add(evaluation)

    for field, value in data.items():
        setattr(evaluation, field, value)

    db.commit()
    db.refresh(evaluation)
    return evaluation


def update_interview(
    db: Session,
    interview: Interview,
    data: dict,
) -> Interview:
    for field, value in data.items():
        setattr(interview, field, value)

    db.commit()
    db.refresh(interview)
    return interview