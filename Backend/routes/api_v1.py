from fastapi import APIRouter
from routes import auth, balances, expenses, friends, groups, notifications, settlements, users

api_v1_router = APIRouter(prefix="/api/v1")

api_v1_router.include_router(auth.router)
api_v1_router.include_router(users.router)
api_v1_router.include_router(friends.router)
api_v1_router.include_router(groups.router)
api_v1_router.include_router(expenses.router)
api_v1_router.include_router(balances.router)
api_v1_router.include_router(settlements.router)
api_v1_router.include_router(notifications.router)

