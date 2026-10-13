from datetime import datetime
from pydantic import BaseModel, Field, model_validator


class InterviewCreate(BaseModel):
    title: str = Field(min_length=2, max_length=200)
    description: str | None = Field(default=None, max_length=5000)
    student_id: int = Field(gt=0)
    organization_id: int | None = Field(default=None, gt=0)
    scheduled_at: datetime | None = None


class InterviewQuestionCreate(BaseModel):
    question_id: int = Field(gt=0)
    order_index: int = Field(default=0, ge=0)


class InterviewObservationCreate(BaseModel):
    category: str = Field(min_length=1, max_length=50)
    note: str = Field(min_length=1, max_length=10000)


class InterviewCodeSnapshotCreate(BaseModel):
    question_id: int = Field(gt=0)
    language: str = Field(pattern="^(python|javascript)$")
    code: str = Field(max_length=50000)
    reason: str = Field(default="periodic", max_length=50)

class InterviewCodeSnapshotOut(BaseModel):
    id: int
    interview_id: int
    question_id: int
    language: str
    code: str
    version: int
    reason: str
    created_at: datetime

    class Config:
        from_attributes = True

class InterviewCodeRunRequest(BaseModel):
    question_id: int = Field(gt=0)
    source_code: str = Field(max_length=50000)


class InterviewEvaluationCreate(BaseModel):
    problem_solving_score: float | None = Field(default=None, ge=0, le=10)
    technical_knowledge_score: float | None = Field(default=None, ge=0, le=10)
    code_quality_score: float | None = Field(default=None, ge=0, le=10)
    communication_score: float | None = Field(default=None, ge=0, le=10)
    debugging_score: float | None = Field(default=None, ge=0, le=10)

    overall_score: float | None = None
    
    strengths: str | None = Field(default=None, max_length=10000)
    weaknesses: str | None = Field(default=None, max_length=10000)
    overall_feedback: str | None = Field(default=None, max_length=10000)

    recommendation: str | None = Field(
        default=None,
        pattern="^(strong_yes|yes|mixed|no|strong_no)$",
    )

    @model_validator(mode="after")
    def calculate_overall_score(self):
        scores = [
            self.problem_solving_score,
            self.technical_knowledge_score,
            self.code_quality_score,
            self.communication_score,
            self.debugging_score,
        ]

        provided_scores = [score for score in scores if score is not None]

        if provided_scores:
            self.overall_score = round(
                sum(provided_scores) / len(provided_scores), 2
            )

        return self


class InterviewQuestionOut(BaseModel):
    id: int
    question_id: int
    order_index: int

    class Config:
        from_attributes = True


class InterviewObservationOut(BaseModel):
    id: int
    examiner_id: int
    category: str
    note: str
    created_at: datetime

    class Config:
        from_attributes = True


class InterviewEvaluationOut(BaseModel):
    id: int
    examiner_id: int

    problem_solving_score: float | None
    technical_knowledge_score: float | None
    code_quality_score: float | None
    communication_score: float | None
    debugging_score: float | None
    overall_score: float | None

    strengths: str | None
    weaknesses: str | None
    overall_feedback: str | None
    recommendation: str | None

    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class InterviewOut(BaseModel):
    id: int
    examiner_id: int
    student_id: int
    organization_id: int | None

    title: str
    description: str | None
    status: str

    scheduled_at: datetime | None
    started_at: datetime | None
    ended_at: datetime | None
    created_at: datetime

    class Config:
        from_attributes = True


class InterviewDetailOut(InterviewOut):
    questions: list[InterviewQuestionOut] = []
    observations: list[InterviewObservationOut] = []
    evaluation: InterviewEvaluationOut | None = None