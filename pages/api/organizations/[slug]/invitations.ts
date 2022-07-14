import type { NextApiRequest, NextApiResponse } from "next";

import type { Role } from "types";
import invitations from "models/invitations";
import tenants from "models/tenants";
import { getSession } from "@lib/session";
import users from "models/users";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { method } = req;

  switch (method) {
    case "POST":
      return handlePOST(req, res);
    case "PUT":
      return handlePUT(req, res);
    default:
      res.setHeader("Allow", ["POST", "PUT"]);
      res.status(405).json({
        data: null,
        error: { message: `Method ${method} Not Allowed` },
      });
  }
}

// Invite a user to an organization
const handlePOST = async (req: NextApiRequest, res: NextApiResponse) => {
  const { email, role } = req.body;
  const { slug } = req.query;

  const session = await getSession(req, res);

  const tenant = await tenants.getTenantBySlug(slug as string);
  const user = await users.getUserBySession(session);

  if (!tenant || !user) {
    return res.status(404).json({
      data: null,
      error: { message: "Tenant or user not found" },
    });
  }

  const invitation = await invitations.createInvitation({
    tenant,
    user,
    email,
    role,
  });

  return res.status(200).json({ data: invitation, error: null });
};

// Accept an invitation to an organization
const handlePUT = async (req: NextApiRequest, res: NextApiResponse) => {
  const { invitationToken } = req.body;

  const session = await getSession(req, res);

  if (!session || !session.user) {
    return res
      .status(401)
      .json({ data: null, error: { message: "Not authenticated" } });
  }

  const invitation = await invitations.getInvitation(invitationToken);

  if (!invitation) {
    return res.status(404).json({
      data: null,
      error: {
        message: "Invitation not found",
      },
    });
  }

  const organization = await tenants.addUser({
    userId: session.user.id,
    tenantId: invitation.tenant.id,
    role: invitation.role as Role,
  });

  if (!organization) {
    return res.status(500).json({
      data: null,
      error: {
        message: "Failed to accept invitation. Contact your administrator.",
      },
    });
  }

  await invitations.deleteInvitation(invitationToken);

  return res.status(200).json({ data: organization, error: null });
};