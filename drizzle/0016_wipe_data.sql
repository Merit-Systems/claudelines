-- Start the public registry empty. Keep the schema and migration history.
TRUNCATE TABLE feedback, events, identities, statuslines CASCADE;
