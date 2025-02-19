export type GroupOptions = {
	name: string;
	isPublic?: boolean;
};

export type UpdateGroupOptions = {
	groupId: string;
	name?: string;
	isPublic?: boolean;
};

export type GetGroupOptions = {
	groupId: string;
};

export type GroupListResponse = {
	groups: GroupResponseItem[];
	next_page_token: string;
};

export type GroupResponseItem = {
	id: string;
	is_public: boolean;
	name: string;
	createdAt: string;
};

export type GroupQueryOptions = {
	name?: string;
	limit?: number;
	pageToken?: string;
	isPublic?: boolean;
};

export type GroupCIDOptions = {
	groupId: string;
	files: string[];
};

export type UpdateGroupFilesResponse = {
	id: string;
	status: string;
};
