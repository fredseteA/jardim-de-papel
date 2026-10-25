"""Initial catalog and reading data. No data is inserted.

Revision ID: 0001_initial
"""
from alembic import op

revision = "0001_initial"
down_revision = None
branch_labels = None
depends_on = None

def upgrade():
    op.execute("CREATE TABLE media_assets (\n\tid UUID NOT NULL, \n\tstorage_provider VARCHAR(50) NOT NULL, \n\tstorage_bucket VARCHAR(255) NOT NULL, \n\tstorage_path TEXT NOT NULL, \n\tmedia_type VARCHAR(20) NOT NULL, \n\tmime_type VARCHAR(100) NOT NULL, \n\tfile_size BIGINT, \n\twidth INTEGER, \n\theight INTEGER, \n\tduration_seconds INTEGER, \n\tmetadata JSONB DEFAULT '{}' NOT NULL, \n\tcreated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, \n\tupdated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, \n\tPRIMARY KEY (id), \n\tCONSTRAINT ck_media_type CHECK (media_type IN ('image','video','audio','animation')), \n\tCONSTRAINT ck_media_size CHECK (file_size IS NULL OR file_size >= 0)\n)")
    op.execute('CREATE TABLE users (\n\tid UUID NOT NULL, \n\tauth_provider_subject VARCHAR(255), \n\tcreated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, \n\tupdated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, \n\tPRIMARY KEY (id), \n\tUNIQUE (auth_provider_subject)\n)')
    op.execute("CREATE TABLE collections (\n\tid UUID NOT NULL, \n\tslug VARCHAR(180) NOT NULL, \n\ttitle VARCHAR(255) NOT NULL, \n\tdescription TEXT DEFAULT '' NOT NULL, \n\tcover_asset_id UUID, \n\tdecorative_asset_id UUID, \n\tdisplay_order INTEGER DEFAULT '0' NOT NULL, \n\tstatus VARCHAR(20) DEFAULT 'draft' NOT NULL, \n\tcreated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, \n\tupdated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, \n\tPRIMARY KEY (id), \n\tCONSTRAINT ck_collection_status CHECK (status IN ('draft','published','archived')), \n\tFOREIGN KEY(cover_asset_id) REFERENCES media_assets (id), \n\tFOREIGN KEY(decorative_asset_id) REFERENCES media_assets (id)\n)")
    op.execute('CREATE UNIQUE INDEX ix_collections_slug ON collections (slug)')
    op.execute('CREATE INDEX ix_collections_status ON collections (status)')
    op.execute('CREATE TABLE reading_profiles (\n\tid UUID NOT NULL, \n\tuser_id UUID NOT NULL, \n\tdisplay_name VARCHAR(80) NOT NULL, \n\tcreated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, \n\tupdated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, \n\tPRIMARY KEY (id), \n\tFOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE\n)')
    op.execute('CREATE INDEX ix_reading_profiles_user_id ON reading_profiles (user_id)')
    op.execute("CREATE TABLE stories (\n\tid UUID NOT NULL, \n\tslug VARCHAR(180) NOT NULL, \n\ttitle VARCHAR(255) NOT NULL, \n\tsubtitle VARCHAR(255), \n\tsynopsis TEXT DEFAULT '' NOT NULL, \n\tdescription TEXT DEFAULT '' NOT NULL, \n\tcover_asset_id UUID, \n\thero_asset_id UUID, \n\tminimum_age INTEGER, \n\tmaximum_age INTEGER, \n\testimated_reading_minutes INTEGER, \n\tlanguage VARCHAR(20) DEFAULT 'pt-BR' NOT NULL, \n\tstatus VARCHAR(20) DEFAULT 'draft' NOT NULL, \n\tpublished_at TIMESTAMP WITH TIME ZONE, \n\tcreated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, \n\tupdated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, \n\tPRIMARY KEY (id), \n\tCONSTRAINT ck_story_status CHECK (status IN ('draft','published','archived')), \n\tCONSTRAINT ck_story_min_age CHECK (minimum_age IS NULL OR minimum_age >= 0), \n\tCONSTRAINT ck_story_age_range CHECK (maximum_age IS NULL OR maximum_age >= COALESCE(minimum_age, 0)), \n\tCONSTRAINT ck_story_minutes CHECK (estimated_reading_minutes IS NULL OR estimated_reading_minutes > 0), \n\tFOREIGN KEY(cover_asset_id) REFERENCES media_assets (id), \n\tFOREIGN KEY(hero_asset_id) REFERENCES media_assets (id)\n)")
    op.execute('CREATE UNIQUE INDEX ix_stories_slug ON stories (slug)')
    op.execute('CREATE INDEX ix_stories_status ON stories (status)')
    op.execute('CREATE TABLE chapters (\n\tid UUID NOT NULL, \n\tstory_id UUID NOT NULL, \n\ttitle VARCHAR(255) NOT NULL, \n\tdescription TEXT, \n\tdisplay_order INTEGER NOT NULL, \n\tcreated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, \n\tupdated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, \n\tPRIMARY KEY (id), \n\tCONSTRAINT uq_chapter_order UNIQUE (story_id, display_order), \n\tCONSTRAINT uq_chapter_story_id UNIQUE (story_id, id), \n\tFOREIGN KEY(story_id) REFERENCES stories (id) ON DELETE CASCADE\n)')
    op.execute('CREATE INDEX ix_chapters_story_id ON chapters (story_id)')
    op.execute("CREATE TABLE collection_stories (\n\tcollection_id UUID NOT NULL, \n\tstory_id UUID NOT NULL, \n\tdisplay_order INTEGER DEFAULT '0' NOT NULL, \n\tPRIMARY KEY (collection_id, story_id), \n\tFOREIGN KEY(collection_id) REFERENCES collections (id) ON DELETE CASCADE, \n\tFOREIGN KEY(story_id) REFERENCES stories (id) ON DELETE CASCADE\n)")
    op.execute('CREATE INDEX ix_collection_stories_story_id ON collection_stories (story_id)')
    op.execute('CREATE TABLE favorites (\n\treading_profile_id UUID NOT NULL, \n\tstory_id UUID NOT NULL, \n\tcreated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, \n\tPRIMARY KEY (reading_profile_id, story_id), \n\tFOREIGN KEY(reading_profile_id) REFERENCES reading_profiles (id) ON DELETE CASCADE, \n\tFOREIGN KEY(story_id) REFERENCES stories (id) ON DELETE CASCADE\n)')
    op.execute("CREATE TABLE scenes (\n\tid UUID NOT NULL, \n\tchapter_id UUID NOT NULL, \n\tdisplay_order INTEGER NOT NULL, \n\ttitle VARCHAR(255), \n\tnarrative_text TEXT NOT NULL, \n\testimated_duration_seconds INTEGER, \n\ttext_position VARCHAR(30), \n\ttext_animation VARCHAR(30), \n\ttransition_type VARCHAR(30), \n\tpresentation_config JSONB DEFAULT '{}' NOT NULL, \n\tcreated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, \n\tupdated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, \n\tPRIMARY KEY (id), \n\tCONSTRAINT uq_scene_order UNIQUE (chapter_id, display_order), \n\tCONSTRAINT uq_scene_chapter_id UNIQUE (chapter_id, id), \n\tCONSTRAINT ck_scene_duration CHECK (estimated_duration_seconds IS NULL OR estimated_duration_seconds > 0), \n\tFOREIGN KEY(chapter_id) REFERENCES chapters (id) ON DELETE CASCADE\n)")
    op.execute('CREATE INDEX ix_scenes_chapter_id ON scenes (chapter_id)')
    op.execute("CREATE TABLE reading_progress (\n\tid UUID NOT NULL, \n\treading_profile_id UUID NOT NULL, \n\tstory_id UUID NOT NULL, \n\tchapter_id UUID, \n\tscene_id UUID, \n\tcompletion_percentage NUMERIC(5, 2) DEFAULT '0' NOT NULL, \n\tcompleted_at TIMESTAMP WITH TIME ZONE, \n\tlast_read_at TIMESTAMP WITH TIME ZONE, \n\tcreated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, \n\tupdated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, \n\tPRIMARY KEY (id), \n\tCONSTRAINT uq_progress_profile_story UNIQUE (reading_profile_id, story_id), \n\tCONSTRAINT fk_progress_story_chapter FOREIGN KEY(story_id, chapter_id) REFERENCES chapters (story_id, id), \n\tCONSTRAINT fk_progress_chapter_scene FOREIGN KEY(chapter_id, scene_id) REFERENCES scenes (chapter_id, id), \n\tCONSTRAINT ck_progress_percentage CHECK (completion_percentage >= 0 AND completion_percentage <= 100), \n\tCONSTRAINT ck_progress_scene_chapter CHECK (scene_id IS NULL OR chapter_id IS NOT NULL), \n\tFOREIGN KEY(reading_profile_id) REFERENCES reading_profiles (id) ON DELETE CASCADE, \n\tFOREIGN KEY(story_id) REFERENCES stories (id) ON DELETE CASCADE\n)")
    op.execute("CREATE TABLE scene_media (\n\tid UUID NOT NULL, \n\tscene_id UUID NOT NULL, \n\tmedia_asset_id UUID NOT NULL, \n\trole VARCHAR(30) NOT NULL, \n\tdisplay_order INTEGER DEFAULT '0' NOT NULL, \n\tconfiguration JSONB DEFAULT '{}' NOT NULL, \n\tPRIMARY KEY (id), \n\tCONSTRAINT ck_scene_media_role CHECK (role IN ('background','illustration','animation','narration','ambient_music','sound_effect')), \n\tCONSTRAINT uq_scene_media_order UNIQUE (scene_id, role, display_order), \n\tFOREIGN KEY(scene_id) REFERENCES scenes (id) ON DELETE CASCADE, \n\tFOREIGN KEY(media_asset_id) REFERENCES media_assets (id)\n)")
    op.execute('CREATE INDEX ix_scene_media_scene_id ON scene_media (scene_id)')

def downgrade():
    op.drop_table('scene_media')
    op.drop_table('reading_progress')
    op.drop_table('scenes')
    op.drop_table('favorites')
    op.drop_table('collection_stories')
    op.drop_table('chapters')
    op.drop_table('stories')
    op.drop_table('reading_profiles')
    op.drop_table('collections')
    op.drop_table('users')
    op.drop_table('media_assets')
