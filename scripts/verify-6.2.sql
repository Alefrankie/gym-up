SELECT count(*) AS total_users, count(*) FILTER (WHERE email LIKE '%@example.com') AS example_users FROM auth.users;
