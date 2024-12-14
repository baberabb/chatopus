import React from "react";
import Avatar from "@mui/material/Avatar";
import { stringAvatar } from "./utils";

interface UserAvatarProps {
  user: string;
  imageUrl?: string;
}

export const UserAvatar: React.FC<UserAvatarProps> = ({ user, imageUrl }) => {
  const user_ = user.toLowerCase();
  const avatarProps = React.useMemo(() => stringAvatar(user_), [user_]);

  return imageUrl ? (
    <Avatar alt={user} src={imageUrl} />
  ) : (
    <Avatar {...avatarProps} />
  );
};
