"""Business logic for interactive coding interviews."""

from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.enums import InterviewStatus
from app.repositories import interview_repository
from app.repositories import user_repository

from app.services import code_runner_service


def _now():
    return datetime.now(timezone.utc)


def _get_examiner(db: Session, user_id: int):
    examiner = user_repository.get_examiner_by_user_id(db, user_id)
    if not examiner:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Examiner profile not found",
        )
    return examiner


def _get_student(db: Session, student_id: int):
    student = user_repository.get_student_by_id(db, student_id)
    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Student not found",
        )
    return student


def _get_owned_interview(
    db: Session,
    interview_id: int,
    examiner_id: int,
):
    interview = interview_repository.get_interview(db, interview_id)

    if not interview:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Interview not found",
        )

    if interview.examiner_id != examiner_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have access to this interview",
        )

    return interview


def _get_candidate_interview(
    db: Session,
    interview_id: int,
    student_id: int,
):
    interview = interview_repository.get_interview(db, interview_id)

    if not interview:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Interview not found",
        )

    if interview.student_id != student_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have access to this interview",
        )

    return interview


def create_interview(
    db: Session,
    user_id: int,
    title: str,
    description: str | None,
    student_id: int,
    organization_id: int | None,
    scheduled_at,
):
    examiner = _get_examiner(db, user_id)
    student = _get_student(db, student_id)

    # Keep interviews inside the examiner's organization.
    examiner_org = examiner.organization_id
    student_org = student.organization_id

    if examiner_org and student_org and examiner_org != student_org:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Student does not belong to the examiner's organization",
        )

    if organization_id is not None and examiner_org != organization_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid organization",
        )

    interview = interview_repository.create_interview(
        db,
        {
            "examiner_id": examiner.id,
            "student_id": student.id,
            "organization_id": examiner_org or organization_id,
            "title": title,
            "description": description,
            "status": (
                InterviewStatus.SCHEDULED
                if scheduled_at
                else InterviewStatus.DRAFT
            ),
            "scheduled_at": scheduled_at,
        },
    )

    return interview


def list_interviews_for_examiner(db: Session, user_id: int):
    examiner = _get_examiner(db, user_id)
    return interview_repository.list_interviews_for_examiner(
        db,
        examiner.id,
    )


def list_interviews_for_student(db: Session, user_id: int):
    student = user_repository.get_student_by_user_id(db, user_id)

    if not student:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Student profile not found",
        )

    return interview_repository.list_interviews_for_student(
        db,
        student.id,
    )


def get_interview_for_examiner(
    db: Session,
    user_id: int,
    interview_id: int,
):
    examiner = _get_examiner(db, user_id)

    return _get_owned_interview(
        db,
        interview_id,
        examiner.id,
    )

def get_interview_for_student(
    db: Session,
    user_id: int,
    interview_id: int,
):
    student = user_repository.get_student_by_user_id(db, user_id)

    if not student:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Student profile not found",
        )

    return _get_candidate_interview(
        db,
        interview_id,
        student.id,
    )

def get_interview_questions(
    db: Session,
    user_id: int,
    interview_id: int,
):
    student = user_repository.get_student_by_user_id(db, user_id)

    if student:
        interview = _get_candidate_interview(
            db,
            interview_id,
            student.id,
        )
        return interview.questions

    examiner = user_repository.get_examiner_by_user_id(db, user_id)

    if examiner:
        interview = _get_owned_interview(
            db,
            interview_id,
            examiner.id,
        )
        return interview.questions

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="You do not have access to this interview",
    )


def add_question(
    db: Session,
    user_id: int,
    interview_id: int,
    question_id: int,
    order_index: int,
):
    examiner = _get_examiner(db, user_id)

    interview = _get_owned_interview(
        db,
        interview_id,
        examiner.id,
    )

    if interview.status not in (
        InterviewStatus.DRAFT,
        InterviewStatus.SCHEDULED,
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Questions can only be added before the interview starts",
        )

    # Import here to keep service imports lightweight.
    from app.repositories import exam_repository

    question = exam_repository.get_question(db, question_id)

    if not question:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Question not found",
        )

    if question.question_type != "coding":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only coding questions can be used in coding interviews",
        )

    # Ensure the examiner owns the exam containing this question.
    if not question.section or not question.section.exam:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Question is not attached to a valid exam",
        )

    if question.section.exam.examiner_id != examiner.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You cannot use this question",
        )

    existing = [
        item
        for item in interview.questions
        if item.question_id == question_id
    ]

    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Question is already assigned to this interview",
        )

    return interview_repository.add_question(
        db,
        interview_id,
        question_id,
        order_index,
    )


def _change_status(
    db: Session,
    interview,
    new_status: InterviewStatus,
):
    interview.status = new_status

    if new_status == InterviewStatus.LIVE:
        if interview.started_at is None:
            interview.started_at = _now()

    if new_status == InterviewStatus.COMPLETED:
        interview.ended_at = _now()

    return interview_repository.update_interview(
        db,
        interview,
        {
            "status": interview.status,
            "started_at": interview.started_at,
            "ended_at": interview.ended_at,
        },
    )


def start_interview(
    db: Session,
    user_id: int,
    interview_id: int,
):
    examiner = _get_examiner(db, user_id)

    interview = _get_owned_interview(
        db,
        interview_id,
        examiner.id,
    )

    if interview.status not in (
        InterviewStatus.DRAFT,
        InterviewStatus.SCHEDULED,
        InterviewStatus.WAITING,
        InterviewStatus.PAUSED,
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Interview cannot be started from status '{interview.status.value}'",
        )

    return _change_status(
        db,
        interview,
        InterviewStatus.LIVE,
    )


def pause_interview(
    db: Session,
    user_id: int,
    interview_id: int,
):
    examiner = _get_examiner(db, user_id)

    interview = _get_owned_interview(
        db,
        interview_id,
        examiner.id,
    )

    if interview.status != InterviewStatus.LIVE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only a live interview can be paused",
        )

    return _change_status(
        db,
        interview,
        InterviewStatus.PAUSED,
    )


def resume_interview(
    db: Session,
    user_id: int,
    interview_id: int,
):
    examiner = _get_examiner(db, user_id)

    interview = _get_owned_interview(
        db,
        interview_id,
        examiner.id,
    )

    if interview.status != InterviewStatus.PAUSED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only a paused interview can be resumed",
        )

    return _change_status(
        db,
        interview,
        InterviewStatus.LIVE,
    )


def complete_interview(
    db: Session,
    user_id: int,
    interview_id: int,
):
    examiner = _get_examiner(db, user_id)

    interview = _get_owned_interview(
        db,
        interview_id,
        examiner.id,
    )

    if interview.status not in (
        InterviewStatus.LIVE,
        InterviewStatus.PAUSED,
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only a live or paused interview can be completed",
        )

    return _change_status(
        db,
        interview,
        InterviewStatus.COMPLETED,
    )


def add_observation(
    db: Session,
    user_id: int,
    interview_id: int,
    category: str,
    note: str,
):
    examiner = _get_examiner(db, user_id)

    interview = _get_owned_interview(
        db,
        interview_id,
        examiner.id,
    )

    if interview.status in (
        InterviewStatus.COMPLETED,
        InterviewStatus.EVALUATED,
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Observations cannot be added after the interview is completed",
        )

    return interview_repository.add_observation(
        db,
        interview_id,
        examiner.id,
        category,
        note,
    )


def save_code_snapshot(
    db: Session,
    user_id: int,
    interview_id: int,
    question_id: int,
    language: str,
    code: str,
    reason: str,
):
    interview = get_interview_for_student(
        db,
        user_id,
        interview_id,
    )

    if interview.status not in (
        InterviewStatus.WAITING,
        InterviewStatus.LIVE,
        InterviewStatus.PAUSED,
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Code cannot be saved in the current interview state",
        )

    assigned_question = next(
        (
            item
            for item in interview.questions
            if item.question_id == question_id
        ),
        None,
    )

    if not assigned_question:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Question is not assigned to this interview",
        )

    if assigned_question.question.language != language:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Code language does not match the interview question",
        )

    return interview_repository.save_code_snapshot(
        db,
        interview_id,
        question_id,
        language,
        code,
        reason,
    )

def get_code_snapshots(
    db: Session,
    user_id: int,
    interview_id: int,
):
    examiner = _get_examiner(db, user_id)

    interview = _get_owned_interview(
        db,
        interview_id,
        examiner.id,
    )

    return interview_repository.get_code_snapshots(
        db,
        interview.id,
    )

def run_code(
    db: Session,
    user_id: int,
    interview_id: int,
    question_id: int,
    source_code: str,
):
    interview = get_interview_for_student(
        db,
        user_id,
        interview_id,
    )

    if interview.status not in (
        InterviewStatus.WAITING,
        InterviewStatus.LIVE,
        InterviewStatus.PAUSED,
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Code cannot be run in the current interview state",
        )

    assigned_question = next(
        (
            item
            for item in interview.questions
            if item.question_id == question_id
        ),
        None,
    )

    if not assigned_question:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Question is not assigned to this interview",
        )

    question = assigned_question.question

    return code_runner_service.run_against_test_cases(
        question.language,
        source_code,
        question.sample_test_cases,
        question.time_limit_seconds,
    )

def evaluate_interview(
    db: Session,
    user_id: int,
    interview_id: int,
    data: dict,
):
    examiner = _get_examiner(db, user_id)

    interview = _get_owned_interview(
        db,
        interview_id,
        examiner.id,
    )

    if interview.status not in (
        InterviewStatus.COMPLETED,
        InterviewStatus.EVALUATED,
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Interview must be completed before evaluation",
        )

    existing = interview_repository.get_evaluation(
        db,
        interview_id,
    )

    score_fields = [
        "problem_solving_score",
        "technical_knowledge_score",
        "code_quality_score",
        "communication_score",
        "debugging_score",
    ]

    merged = {}

    for field in score_fields:
        incoming = data.get(field)

        if incoming is not None:
            merged[field] = incoming
        elif existing is not None:
            merged[field] = getattr(existing, field)
        else:
            merged[field] = None

    provided_scores = [
        merged[field]
        for field in score_fields
        if merged[field] is not None
    ]

    merged["overall_score"] = (
        round(sum(provided_scores) / len(provided_scores), 2)
        if provided_scores
        else None
    )

    for field in (
        "strengths",
        "weaknesses",
        "overall_feedback",
        "recommendation",
    ):
        if field in data:
            merged[field] = data[field]

    merged["examiner_id"] = examiner.id

    evaluation = interview_repository.create_or_update_evaluation(
        db,
        interview_id,
        examiner.id,
        merged,
    )

    interview.status = InterviewStatus.EVALUATED

    interview_repository.update_interview(
        db,
        interview,
        {"status": InterviewStatus.EVALUATED},
    )

    return evaluation