"""Retrieval-quality checks for the BM25 hybrid retriever.

Pure unit test — no server or DB. Verifies BM25 ranks the correct chunk first
for keyword queries, that sentence-aware chunking splits long text, and that
Reciprocal Rank Fusion combines rankings.
"""
from app import embeddings, retrieval

# A small "knowledge base" of distinct facts, one per chunk.
DOCS = [
    ("c1", "The office is open from 9am to 5pm on weekdays."),
    ("c2", "Reimbursements are processed on the last Friday of each month."),
    ("c3", "The parental leave policy grants 26 weeks of paid leave."),
    ("c4", "Employees accrue 20 vacation days per year."),
    ("c5", "The VPN gateway is vpn.acme.internal and requires MFA to connect."),
]

cases = {
    "how many weeks of parental leave do I get": "c3",
    "what is the vpn gateway address": "c5",
    "when are reimbursements processed": "c2",
    "how many vacation days per year": "c4",
    "what are the office hours": "c1",
}

for question, expected in cases.items():
    ranked = retrieval.bm25_rank(question, DOCS)
    top = ranked[0][0]
    assert top == expected, f"{question!r}: expected {expected}, got {top} ({ranked})"
    print(f"ok  {question!r:52} -> {top}")

# Sentence-aware chunking splits long text into multiple coherent chunks.
long_text = " ".join(f"Fact number {i} covers an important detail about topic {i}." for i in range(60))
chunks = embeddings.chunk_text(long_text, target_words=40)
assert len(chunks) > 1, f"expected multiple chunks, got {len(chunks)}"
assert all(chunks), "no empty chunks"
print(f"\nchunking: {len(chunks)} chunks from {len(long_text.split())} words")

# Reciprocal Rank Fusion merges rankings.
fused = retrieval.rrf_fuse([["a", "b", "c"], ["b", "a", "d"]])
fused_ids = [i for i, _ in fused]
assert fused_ids[0] in ("a", "b"), fused
print("rrf fusion:", fused_ids)

print("\nALL RETRIEVAL CHECKS PASSED")
