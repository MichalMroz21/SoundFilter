export interface UserResponse {
    id: number;
    roles: Role;
    firstName?: string,
    lastName?: string,
    email: string;
    profileImageUrl?: string;
    connectedAccounts: ConnectedAccount[];
    audioProjects: AudioProject[];
}

export interface ConnectedAccount {
    provider: 'google' | 'github' | 'facebook' | 'okta';
    connectedAt: string;
}

export interface AudioProject {
    name: string
    description?: string
    extension: string
    createdAt: string
    updatedAt: string
}

export enum Role {
    USER = "USER",
    ADMIN = "ADMIN"
}