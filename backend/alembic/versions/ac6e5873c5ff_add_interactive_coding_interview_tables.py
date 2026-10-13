"""add interactive coding interview tables

Revision ID: ac6e5873c5ff
Revises: 0031
Create Date: 2026-09-20
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "ac6e5873c5ff"
down_revision: Union[str, None] = "0031"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "interviews",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("examiner_id", sa.Integer(), nullable=False),
        sa.Column("student_id", sa.Integer(), nullable=False),
        sa.Column("organization_id", sa.Integer(), nullable=True),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("status", sa.Enum(
            "DRAFT",
            "SCHEDULED",
            "WAITING",
            "LIVE",
            "PAUSED",
            "COMPLETED",
            "EVALUATED",
            name="interviewstatus",
        ), nullable=False),
        sa.Column("scheduled_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("ended_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["examiner_id"],
            ["examiners.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["student_id"],
            ["students.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_index(
        op.f("ix_interviews_id"),
        "interviews",
        ["id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_interviews_examiner_id"),
        "interviews",
        ["examiner_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_interviews_student_id"),
        "interviews",
        ["student_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_interviews_organization_id"),
        "interviews",
        ["organization_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_interviews_status"),
        "interviews",
        ["status"],
        unique=False,
    )

    op.create_table(
        "interview_questions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("interview_id", sa.Integer(), nullable=False),
        sa.Column("question_id", sa.Integer(), nullable=False),
        sa.Column("order_index", sa.Integer(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["interview_id"],
            ["interviews.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["question_id"],
            ["questions.id"],
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_index(
        op.f("ix_interview_questions_id"),
        "interview_questions",
        ["id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_interview_questions_interview_id"),
        "interview_questions",
        ["interview_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_interview_questions_question_id"),
        "interview_questions",
        ["question_id"],
        unique=False,
    )

    op.create_table(
        "interview_observations",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("interview_id", sa.Integer(), nullable=False),
        sa.Column("examiner_id", sa.Integer(), nullable=False),
        sa.Column("category", sa.String(length=50), nullable=False),
        sa.Column("note", sa.Text(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["interview_id"],
            ["interviews.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["examiner_id"],
            ["examiners.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_index(
        op.f("ix_interview_observations_id"),
        "interview_observations",
        ["id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_interview_observations_interview_id"),
        "interview_observations",
        ["interview_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_interview_observations_examiner_id"),
        "interview_observations",
        ["examiner_id"],
        unique=False,
    )

    op.create_table(
        "interview_evaluations",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("interview_id", sa.Integer(), nullable=False),
        sa.Column("examiner_id", sa.Integer(), nullable=False),
        sa.Column("problem_solving_score", sa.Float(), nullable=True),
        sa.Column("technical_knowledge_score", sa.Float(), nullable=True),
        sa.Column("code_quality_score", sa.Float(), nullable=True),
        sa.Column("communication_score", sa.Float(), nullable=True),
        sa.Column("debugging_score", sa.Float(), nullable=True),
        sa.Column("overall_score", sa.Float(), nullable=True),
        sa.Column("strengths", sa.Text(), nullable=True),
        sa.Column("weaknesses", sa.Text(), nullable=True),
        sa.Column("overall_feedback", sa.Text(), nullable=True),
        sa.Column("recommendation", sa.String(length=50), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["interview_id"],
            ["interviews.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["examiner_id"],
            ["examiners.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("interview_id"),
    )

    op.create_index(
        op.f("ix_interview_evaluations_id"),
        "interview_evaluations",
        ["id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_interview_evaluations_interview_id"),
        "interview_evaluations",
        ["interview_id"],
        unique=True,
    )
    op.create_index(
        op.f("ix_interview_evaluations_examiner_id"),
        "interview_evaluations",
        ["examiner_id"],
        unique=False,
    )

    op.create_table(
        "interview_code_snapshots",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("interview_id", sa.Integer(), nullable=False),
        sa.Column("question_id", sa.Integer(), nullable=False),
        sa.Column("language", sa.String(length=30), nullable=False),
        sa.Column("code", sa.Text(), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("reason", sa.String(length=50), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["interview_id"],
            ["interviews.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["question_id"],
            ["questions.id"],
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_index(
        op.f("ix_interview_code_snapshots_id"),
        "interview_code_snapshots",
        ["id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_interview_code_snapshots_interview_id"),
        "interview_code_snapshots",
        ["interview_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_interview_code_snapshots_question_id"),
        "interview_code_snapshots",
        ["question_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_interview_code_snapshots_question_id"),
        table_name="interview_code_snapshots",
    )
    op.drop_index(
        op.f("ix_interview_code_snapshots_interview_id"),
        table_name="interview_code_snapshots",
    )
    op.drop_index(
        op.f("ix_interview_code_snapshots_id"),
        table_name="interview_code_snapshots",
    )
    op.drop_table("interview_code_snapshots")

    op.drop_index(
        op.f("ix_interview_evaluations_examiner_id"),
        table_name="interview_evaluations",
    )
    op.drop_index(
        op.f("ix_interview_evaluations_interview_id"),
        table_name="interview_evaluations",
    )
    op.drop_index(
        op.f("ix_interview_evaluations_id"),
        table_name="interview_evaluations",
    )
    op.drop_table("interview_evaluations")

    op.drop_index(
        op.f("ix_interview_observations_examiner_id"),
        table_name="interview_observations",
    )
    op.drop_index(
        op.f("ix_interview_observations_interview_id"),
        table_name="interview_observations",
    )
    op.drop_index(
        op.f("ix_interview_observations_id"),
        table_name="interview_observations",
    )
    op.drop_table("interview_observations")

    op.drop_index(
        op.f("ix_interview_questions_question_id"),
        table_name="interview_questions",
    )
    op.drop_index(
        op.f("ix_interview_questions_interview_id"),
        table_name="interview_questions",
    )
    op.drop_index(
        op.f("ix_interview_questions_id"),
        table_name="interview_questions",
    )
    op.drop_table("interview_questions")

    op.drop_index(
        op.f("ix_interviews_status"),
        table_name="interviews",
    )
    op.drop_index(
        op.f("ix_interviews_organization_id"),
        table_name="interviews",
    )
    op.drop_index(
        op.f("ix_interviews_student_id"),
        table_name="interviews",
    )
    op.drop_index(
        op.f("ix_interviews_examiner_id"),
        table_name="interviews",
    )
    op.drop_index(
        op.f("ix_interviews_id"),
        table_name="interviews",
    )
    op.drop_table("interviews")

    op.execute("DROP TYPE IF EXISTS interviewstatus")