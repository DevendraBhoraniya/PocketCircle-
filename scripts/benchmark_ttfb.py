import asyncio
import time
import httpx
from core.database import SessionLocal
from sqlalchemy import select
from models.user import User
from core.security import create_access_token

async def get_test_token():
    async with SessionLocal() as session:
        result = await session.execute(select(User).where(User.deleted_at.is_(None)).limit(1))
        user = result.scalar_one_or_none()
        if not user:
            raise RuntimeError("No user found in DB")
        token = create_access_token({"sub": str(user.id)})
        return token, user.email

async def measure_endpoint(client: httpx.AsyncClient, method: str, endpoint: str, cookies: dict):
    start = time.perf_counter()
    response = await client.request(method, endpoint, cookies=cookies)
    ttfb = (time.perf_counter() - start) * 1000
    return response.status_code, ttfb

async def run_single_suite(client: httpx.AsyncClient, cookies: dict):
    endpoints = [
        "/auth/me",
        "/friends",
        "/groups",
        "/balances/summary",
    ]
    results = {}
    for ep in endpoints:
        status, ttfb = await measure_endpoint(client, "GET", ep, cookies)
        results[ep] = (status, ttfb)
    return results

async def run_burst_test(client: httpx.AsyncClient, cookies: dict, concurrency: int = 5):
    # 5 parallel requests hitting /balances/summary and /groups simultaneously (the heaviest endpoints)
    tasks = []
    for _ in range(concurrency):
        tasks.append(measure_endpoint(client, "GET", "/balances/summary", cookies))
        tasks.append(measure_endpoint(client, "GET", "/groups", cookies))
    start = time.perf_counter()
    burst_results = await asyncio.gather(*tasks)
    total_time = (time.perf_counter() - start) * 1000
    return burst_results, total_time

async def main():
    token, email = await get_test_token()
    print(f"Benchmark user: {email}")
    cookies = {"access_token": token}

    async with httpx.AsyncClient(base_url="http://localhost:8000", timeout=30.0) as client:
        print("\n--- Sequential TTFB Benchmark (3 passes) ---")
        pass_metrics = {ep: [] for ep in ["/auth/me", "/friends", "/groups", "/balances/summary"]}
        for p in range(3):
            suite = await run_single_suite(client, cookies)
            print(f"Pass {p+1}:")
            for ep, (status, ttfb) in suite.items():
                pass_metrics[ep].append(ttfb)
                print(f"  {ep:<20} -> {status} ({ttfb:.2f}ms)")

        print("\n--- Summary Sequential Average TTFB ---")
        for ep, times in pass_metrics.items():
            avg_time = sum(times) / len(times)
            print(f"  {ep:<20} : {avg_time:.2f}ms")

        print("\n--- Concurrency Burst Test (5 parallel requests to /balances/summary + /groups = 10 concurrent) ---")
        burst_results, total_burst_time = await run_burst_test(client, cookies, concurrency=5)
        balances_times = [t for s, t in burst_results[0::2]]
        groups_times = [t for s, t in burst_results[1::2]]
        print(f"Total burst wall time: {total_burst_time:.2f}ms")
        print(f"  /balances/summary avg: {sum(balances_times)/len(balances_times):.2f}ms (min: {min(balances_times):.2f}ms, max: {max(balances_times):.2f}ms)")
        print(f"  /groups avg:           {sum(groups_times)/len(groups_times):.2f}ms (min: {min(groups_times):.2f}ms, max: {max(groups_times):.2f}ms)")

if __name__ == "__main__":
    asyncio.run(main())
