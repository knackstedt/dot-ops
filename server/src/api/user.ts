import * as express from "express";
import { route } from '../util/util';
import { db } from '../util/db';
import { CruiserUserProfile, CruiserUserRoles } from '../types';


const router = express.Router();

// Get user.
router.get('/', route(async (req, res, next) => {
    if (req.session.lockout) {
        return res.send({ lockedOut: true });
    }

    req.session.profile
        ? res.send(req.session.profile)
        : next(401)
}));

// Guard access to the rest of this router.
router.use((req, res, next) => {
    if (!req.session.profile.roles.includes("administrator"))
        return next(403);
    next();
});

router.post('/add', route(async (req, res, next) => {
    const rolesToAdd = req.body.roles as string[];
    const targetUserId = req.body.userId as string;

    const [profile] = await db.create("users:ulid()", {
        login: targetUserId,
        roles: rolesToAdd || []
    } as CruiserUserProfile);

    res.send({ profile });
}));

// router.post('/invite', route(async (req, res, next) => {
//     req.session.gh_user
//         ? res.send(req.session.gh_user)
//         : next(401)
// }));

export const UserApi = router;
