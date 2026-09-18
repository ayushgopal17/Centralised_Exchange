
import jwt from "jsonwebtoken"

export function authMiddleware(req:any,res:any,next:any){

    const token=req.headers.token;

    if(!token){
       return res.status(403).json({
            message: "token not found"
        })
    }
    const decoded:any=jwt.verify(token,"Secret123");
    const userId= decoded.id;
     req.userId= decoded.id;
    if(!userId){
       return res.status(403).json({
            message: "invalid token"
        })
    }
    next();
}

