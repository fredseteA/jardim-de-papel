"""Add application authorization role; no accounts are provisioned.

Revision ID: 0002_user_role
"""
from alembic import op
import sqlalchemy as sa

revision = '0002_user_role'
down_revision = '0001_initial'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('users', sa.Column('role', sa.String(20), nullable=False, server_default='reader'))
    op.create_check_constraint('ck_users_role', 'users', "role IN ('reader', 'admin')")


def downgrade():
    op.drop_constraint('ck_users_role', 'users', type_='check')
    op.drop_column('users', 'role')
