-- Test Users (passwords are 'password123')
insert into auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at)
values
  ('d0d54aa8-7c39-4d0c-9e59-4b49037c0c63', 'alice@test.com', '$2a$10$PxhQpDNsrV1jF.9nS3jF8O8vG3Mjp0L7hDxDVJFR.ksVaVJQXvxKy', now(), now(), now()),
  ('d8c7bcc9-7f8a-4c9c-9c5c-2e9b3c7d6e5f', 'bob@test.com', '$2a$10$PxhQpDNsrV1jF.9nS3jF8O8vG3Mjp0L7hDxDVJFR.ksVaVJQXvxKy', now(), now(), now());

-- Test Profiles
insert into public.profiles (id, username, wallet_address, updated_at)
values
  ('d0d54aa8-7c39-4d0c-9e59-4b49037c0c63', 'Alice', '0x1234567890123456789012345678901234567890', now()),
  ('d8c7bcc9-7f8a-4c9c-9c5c-2e9b3c7d6e5f', 'Bob', '0x0987654321098765432109876543210987654321', now());

-- Test Wallets (example keys - never use these in production!)
insert into public.wallets (profile_id, address, public_key, private_key)
values
  ('d0d54aa8-7c39-4d0c-9e59-4b49037c0c63', 
   '0x1234567890123456789012345678901234567890',
   '04a9b7c8d6e5f4g3h2i1j0k9l8m7n6o5p4q3r2s1t',
   'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0'),
  ('d8c7bcc9-7f8a-4c9c-9c5c-2e9b3c7d6e5f',
   '0x0987654321098765432109876543210987654321',
   '04z9y8x7w6v5u4t3s2r1q0p9o8n7m6l5k4j3h2g1f',
   'z9y8x7w6v5u4t3s2r1q0p9o8n7m6l5k4j3h2g1f0');

-- Test Thread
insert into public.threads (id, name, participant_ids, created_by)
values
  ('f7c6b5a4-3d2e-1f0g-9h8i-7j6k5l4m3n2o',
   'Alice and Bob Chat',
   array['d0d54aa8-7c39-4d0c-9e59-4b49037c0c63', 'd8c7bcc9-7f8a-4c9c-9c5c-2e9b3c7d6e5f'],
   'd0d54aa8-7c39-4d0c-9e59-4b49037c0c63');

-- Test Messages (content would be encrypted in real usage)
insert into public.messages (thread_id, sender_id, content, read)
values
  ('f7c6b5a4-3d2e-1f0g-9h8i-7j6k5l4m3n2o',
   'd0d54aa8-7c39-4d0c-9e59-4b49037c0c63',
   'Hey Bob, how are you?',
   true),
  ('f7c6b5a4-3d2e-1f0g-9h8i-7j6k5l4m3n2o',
   'd8c7bcc9-7f8a-4c9c-9c5c-2e9b3c7d6e5f',
   'Hi Alice! I''m good, thanks for asking!',
   true),
  ('f7c6b5a4-3d2e-1f0g-9h8i-7j6k5l4m3n2o',
   'd0d54aa8-7c39-4d0c-9e59-4b49037c0c63',
   'Great! Want to test the encryption?',
   false);

-- Update thread's last_message_at
update public.threads
set last_message_at = (
  select max(created_at)
  from public.messages
  where thread_id = 'f7c6b5a4-3d2e-1f0g-9h8i-7j6k5l4m3n2o'
)
where id = 'f7c6b5a4-3d2e-1f0g-9h8i-7j6k5l4m3n2o';
