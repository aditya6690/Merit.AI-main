from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.services.interview_redis_service import interview_redis_service

from app.api.deps import get_current_user
from app.database.session import get_db
from app.models.user import User
from app.schemas.interview import (
    InterviewCreate,
    InterviewQuestionCreate,
    InterviewObservationCreate,
    InterviewCodeSnapshotCreate,
    InterviewCodeSnapshotOut,
    InterviewCodeRunRequest,
    InterviewEvaluationCreate,
    InterviewOut,
    InterviewDetailOut,
    InterviewQuestionOut,
    InterviewObservationOut,
    InterviewEvaluationOut,
)
from app.services import interview_service


router = APIRouter(
    prefix="/interviews",
    tags=["Interactive Coding Interviews"],
)


@router.post(
    "",
    response_model=InterviewOut,
    status_code=status.HTTP_201_CREATED,
)
def create_interview(
    data: InterviewCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return interview_service.create_interview(
        db=db,
        user_id=current_user.id,
        title=data.title,
        description=data.description,
        student_id=data.student_id,
        organization_id=data.organization_id,
        scheduled_at=data.scheduled_at,
    )


@router.get(
    "/examiner",
    response_model=list[InterviewOut],
)
def list_examiner_interviews(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return interview_service.list_interviews_for_examiner(
        db,
        current_user.id,
    )


@router.get(
    "/student",
    response_model=list[InterviewOut],
)
def list_student_interviews(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return interview_service.list_interviews_for_student(
        db,
        current_user.id,
    )


@router.get(
    "/{interview_id}",
    response_model=InterviewDetailOut,
)
def get_interview(
    interview_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role.name == "examiner":
        return interview_service.get_interview_for_examiner(
            db,
            current_user.id,
            interview_id,
        )

    return interview_service.get_interview_for_student(
        db,
        current_user.id,
        interview_id,
    )

@router.get(
    "/{interview_id}/questions",
    response_model=list[InterviewQuestionOut],
)
def get_interview_questions(
    interview_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return interview_service.get_interview_questions(
        db=db,
        user_id=current_user.id,
        interview_id=interview_id,
    )

@router.post("/{interview_id}/run-code")
async def run_code(
    interview_id: int,
    data: InterviewCodeRunRequest,
    db=Depends(get_db),
    current_user=Depends(get_current_user),
):
    result = interview_service.run_code(
        db=db,
        user_id=current_user.id,
        interview_id=interview_id,
        question_id=data.question_id,
        source_code=data.source_code,
    )

    await interview_redis_service.publish(
        interview_id,
        {
            "type": "interview_event",
            "interview_id": interview_id,
            "data": {
                "type": "code_run_result",
                "question_id": data.question_id,
                "result": result,
            },
        },
    )

    return result

@router.post(
    "/{interview_id}/questions",
    response_model=InterviewQuestionOut,
    status_code=status.HTTP_201_CREATED,
)
def add_interview_question(
    interview_id: int,
    data: InterviewQuestionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return interview_service.add_question(
        db=db,
        user_id=current_user.id,
        interview_id=interview_id,
        question_id=data.question_id,
        order_index=data.order_index,
    )


@router.post(
    "/{interview_id}/start",
    response_model=InterviewOut,
)
def start_interview(
    interview_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return interview_service.start_interview(
        db,
        current_user.id,
        interview_id,
    )


@router.post(
    "/{interview_id}/pause",
    response_model=InterviewOut,
)
def pause_interview(
    interview_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return interview_service.pause_interview(
        db,
        current_user.id,
        interview_id,
    )


@router.post(
    "/{interview_id}/resume",
    response_model=InterviewOut,
)
def resume_interview(
    interview_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return interview_service.resume_interview(
        db,
        current_user.id,
        interview_id,
    )


@router.post(
    "/{interview_id}/complete",
    response_model=InterviewOut,
)
def complete_interview(
    interview_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return interview_service.complete_interview(
        db,
        current_user.id,
        interview_id,
    )


@router.post(
    "/{interview_id}/observations",
    response_model=InterviewObservationOut,
    status_code=status.HTTP_201_CREATED,
)
def add_observation(
    interview_id: int,
    data: InterviewObservationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return interview_service.add_observation(
        db=db,
        user_id=current_user.id,
        interview_id=interview_id,
        category=data.category,
        note=data.note,
    )


@router.post(
    "/{interview_id}/code-snapshots",
    status_code=status.HTTP_201_CREATED,
)
def save_code_snapshot(
    interview_id: int,
    data: InterviewCodeSnapshotCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return interview_service.save_code_snapshot(
        db=db,
        user_id=current_user.id,
        interview_id=interview_id,
        question_id=data.question_id,
        language=data.language,
        code=data.code,
        reason=data.reason,
)


@router.get(
    "/{interview_id}/code-snapshots",
    response_model=list[InterviewCodeSnapshotOut],
)
def get_code_snapshots(
    interview_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return interview_service.get_code_snapshots(
        db=db,
        user_id=current_user.id,
        interview_id=interview_id,
    )


@router.post(
    "/{interview_id}/evaluation",
    response_model=InterviewEvaluationOut,
)
def evaluate_interview(
    interview_id: int,
    data: InterviewEvaluationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return interview_service.evaluate_interview(
        db=db,
        user_id=current_user.id,
        interview_id=interview_id,
        data=data.model_dump(exclude_unset=True),
    )