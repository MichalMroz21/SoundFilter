export interface UserResponse {
    id: number;
    roles: Role;
    firstName?: string,
    lastName?: string,
    email: string;
    profileImageUrl?: string;
    connectedAccounts: ConnectedAccount[];
}

interface ConnectedAccount {
    provider: 'google' | 'github' | 'facebook' | 'okta';
    connectedAt: string;
}

export enum Role {
    USER = "USER",
    ADMIN = "ADMIN"
}