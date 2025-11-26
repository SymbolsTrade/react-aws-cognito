# Notes Keeper — Folders + Reminders (React + Vite + AWS Cognito)

Features:
- AWS Cognito login via Amplify Authenticator
- Landing page + navigation
- **Notes organized in folders** (lazy loaded per folder)
- **Dashboard with reminders**: create events (title, notes, location, datetime) and see reminders **1 day ahead**

## Quickstart

```bash
npm install
npm run dev
```

Open http://localhost:5173 and click **Sign in** (Dashboard).

## Configure AWS Cognito (User Pools)

1. Create (or reuse) a User Pool.
2. Create an App client for a SPA (**no client secret**).
3. (Optional) Configure Hosted UI domain + redirects:
   - Sign-in: `http://localhost:5173/dashboard`
   - Sign-out: `http://localhost:5173/`
4. Copy `.env.local.example` → `.env.local` and fill values.

> Frontend apps must not embed a client secret. Use a public client with PKCE for OAuth and put any real secrets behind your backend.

## Where to wire your real API
- Notes & folders: `src/api/notesMock.js` (replace with `fetch` to your API)
- Events/reminders: `src/api/eventsMock.js`

### Event object shape
```json
{
  "id": "uuid",
  "title": "string",
  "notes": "string",
  "location": "string",
  "startAtISO": "ISO string",
  "reminderAtISO": "startAtISO - 1 day",
  "reminderDismissed": false
}
```

The dashboard shows reminders when `now >= reminderAtISO` and `now < startAtISO` and `reminderDismissed` is false.

### Create tables
```sql
-- KeepNotes.app_user definition

CREATE TABLE `app_user` (
  `cognito_id` char(40) NOT NULL,
  `cognito_token` text,
  `email` varchar(191) DEFAULT NULL,
  `role` varchar(20) DEFAULT NULL,
  `display_name` varchar(191) DEFAULT NULL,
  `phone` varchar(20) DEFAULT NULL,
  `address` varchar(255) DEFAULT NULL,
  `profile` json DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `last_login_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`cognito_id`),
  UNIQUE KEY `email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


-- KeepNotes.event definition

CREATE TABLE `event` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` char(36) NOT NULL,
  `title` text NOT NULL,
  `notes` longtext NOT NULL,
  `location` text,
  `start_at` timestamp NOT NULL,
  `remind_at` timestamp GENERATED ALWAYS AS ((`start_at` - interval 1 day)) STORED NULL,
  `reminder_dismissed` tinyint(1) NOT NULL DEFAULT '0',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_event_user_start` (`user_id`,`start_at`),
  KEY `idx_event_user_remind` (`user_id`,`reminder_dismissed`,`remind_at`,`start_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


-- KeepNotes.folder definition

CREATE TABLE `folder` (
  `id` char(36) NOT NULL,
  `user_id` char(36) NOT NULL,
  `name` varchar(255) NOT NULL,
  `sort_index` int NOT NULL DEFAULT '1000',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_folder_id_user` (`id`,`user_id`),
  KEY `idx_folder_user_sort` (`user_id`,`sort_index`,`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


-- KeepNotes.note definition

CREATE TABLE `note` (
  `id` char(36) NOT NULL,
  `user_id` char(36) NOT NULL,
  `folder_id` char(36) NOT NULL,
  `title` text NOT NULL,
  `content` longtext NOT NULL,
  `sort_index` int NOT NULL DEFAULT '1000',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_note_folder_sort` (`folder_id`,`sort_index`),
  KEY `idx_note_user_folder_created` (`user_id`,`folder_id`,`created_at`),
  KEY `idx_note_user_deleted` (`user_id`,`deleted_at`),
  FULLTEXT KEY `ftx_note_title_content` (`title`,`content`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

```
