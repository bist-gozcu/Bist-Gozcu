import { Router, type IRouter } from "express";
import healthRouter from "./health";
import bistRouter from "./bist";

const router: IRouter = Router();

router.use(healthRouter);
router.use(bistRouter);

export default router;
