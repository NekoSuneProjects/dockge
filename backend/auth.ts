import { R } from "redbean-node";
import { DockgeSocket, ValidationError } from "./util-server";

export type UserRole = "admin" | "user";

export interface SessionUser {
    id: number;
    username: string;
    display_name: string;
    role: UserRole;
    auth_provider: string;
    owner?: boolean;
}

export async function getUserByID(userID: number | undefined): Promise<SessionUser | null> {
    if (!userID) {
        return null;
    }

    const user = await R.findOne("user", " id = ? AND active = 1 ", [ userID ]) as SessionUser | null;
    return user;
}

export async function getCurrentUser(socket: DockgeSocket): Promise<SessionUser> {
    const user = await getUserByID(socket.userID);
    if (!user) {
        throw new Error("You are not logged in.");
    }
    return user;
}

export function isAdmin(user: SessionUser | null | undefined): boolean {
    return user?.role === "admin" || Boolean(user?.owner);
}

export function isOwner(user: SessionUser | null | undefined): boolean {
    return Boolean(user?.owner);
}

export async function requireAdmin(socket: DockgeSocket): Promise<SessionUser> {
    const user = await getCurrentUser(socket);
    if (!isAdmin(user)) {
        throw new Error("Admin access is required.");
    }
    return user;
}

export async function getAccessibleStacks(userID: number, endpoint: string): Promise<Set<string>> {
    const rows = await R.getAll("SELECT stack_name FROM stack_access WHERE user_id = ? AND endpoint = ? ", [
        userID,
        endpoint,
    ]);

    return new Set(rows.map((row) => row.stack_name));
}

export async function canAccessStack(socket: DockgeSocket, stackName: string, endpoint?: string): Promise<boolean> {
    const user = await getCurrentUser(socket);
    if (isAdmin(user)) {
        return true;
    }

    const rows = await R.getAll("SELECT id FROM stack_access WHERE user_id = ? AND stack_name = ? AND endpoint = ? LIMIT 1", [
        user.id,
        stackName,
        endpoint ?? socket.endpoint ?? "",
    ]);
    return rows.length > 0;
}

export async function requireStackAccess(socket: DockgeSocket, stackName: string, endpoint?: string): Promise<SessionUser> {
    const user = await getCurrentUser(socket);
    if (isAdmin(user)) {
        return user;
    }

    if (!await canAccessStack(socket, stackName, endpoint)) {
        throw new ValidationError("You do not have access to this stack.");
    }

    return user;
}

export async function setStackAssignments(userID: number, assignments: Array<{ stackName: string, endpoint: string }>) {
    await R.exec("DELETE FROM stack_access WHERE user_id = ? ", [ userID ]);

    for (const assignment of assignments) {
        await R.exec("INSERT INTO stack_access (user_id, stack_name, endpoint) VALUES (?, ?, ?)", [
            userID,
            assignment.stackName,
            assignment.endpoint ?? "",
        ]);
    }
}

export async function getStackAssignments(userID: number) {
    return await R.getAll("SELECT stack_name as stackName, endpoint FROM stack_access WHERE user_id = ? ORDER BY endpoint, stack_name", [
        userID,
    ]);
}

export function sessionUserPayload(user: SessionUser) {
    return {
        id: user.id,
        username: user.username,
        displayName: user.display_name || user.username,
        role: user.role,
        authProvider: user.auth_provider,
        owner: Boolean(user.owner),
    };
}
