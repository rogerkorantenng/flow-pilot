from fastapi import Header, HTTPException


async def get_user_id(x_user_id: str = Header(default="")) -> str:
    if not x_user_id:
        raise HTTPException(status_code=401, detail="X-User-Id header is required")
    return x_user_id
