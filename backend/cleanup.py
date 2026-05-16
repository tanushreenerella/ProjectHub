# Cleanup script: removes test accounts and duplicate registrations.
# Run from the backend folder:
#   anaconda3\python.exe cleanup.py

import os, sys, dns.resolver
from dotenv import load_dotenv
import pymongo
from bson import ObjectId
from collections import defaultdict

load_dotenv()

dns.resolver.default_resolver = dns.resolver.Resolver(configure=False)
dns.resolver.default_resolver.nameservers = ["8.8.8.8", "8.8.4.4"]

client = pymongo.MongoClient(os.getenv("MONGO_URI"))
db = client.get_default_database()
users = db["users"]

# ── 1. Remove obvious test/debug accounts ────────────────────────────────────
TEST_NAMES = {"debug user", "fix test", "test user", "unknown user"}
TEST_EMAIL_PATTERNS = ["@test.com", "localtest", "debugtest", "fixtest"]

ids_to_delete = set()

for u in users.find({}):
    name  = u.get("name", "").strip().lower()
    email = u.get("email", "").strip().lower()
    if name in TEST_NAMES:
        ids_to_delete.add(u["_id"])
        continue
    if any(p in email for p in TEST_EMAIL_PATTERNS):
        ids_to_delete.add(u["_id"])

if ids_to_delete:
    result = users.delete_many({"_id": {"$in": list(ids_to_delete)}})
    print(f"Removed {result.deleted_count} test/debug account(s).")
else:
    print("No test accounts found.")

# ── 2. Deduplicate by normalised name ────────────────────────────────────────
# Group all remaining users by lowercased stripped name.
# Keep the one with the most data (skills + interests), delete the rest.
name_groups = defaultdict(list)
for u in users.find({}):
    key = u.get("name", "").strip().lower()
    if key:
        name_groups[key].append(u)

removed_dupes = 0
for name_key, group in name_groups.items():
    if len(group) <= 1:
        continue
    # Score each account by completeness
    def score(u):
        return (
            len(u.get("skills", [])) +
            len(u.get("interests", [])) +
            len(u.get("bio", "")) +
            (10 if u.get("connections") else 0)
        )
    group.sort(key=score, reverse=True)
    keep = group[0]
    dupes = group[1:]
    dupe_ids = [d["_id"] for d in dupes]
    users.delete_many({"_id": {"$in": dupe_ids}})
    removed_dupes += len(dupe_ids)
    print(f"  Kept '{keep.get('name')}' ({keep.get('email')}), removed {len(dupe_ids)} duplicate(s).")

print(f"Removed {removed_dupes} duplicate account(s).")

# ── 3. Final count ────────────────────────────────────────────────────────────
total = users.count_documents({})
print(f"\nDatabase now has {total} user(s).")
for u in users.find({}, {"name": 1, "email": 1, "role": 1}):
    print(f"  {u.get('role','?'):8}  {u.get('name',''):<25}  {u.get('email','')}")
