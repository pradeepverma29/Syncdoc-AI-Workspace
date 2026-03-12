import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth.ts';
import { DocumentMember, UserRole } from '../models/DocumentMember.ts';

// Define role hierarchy: owner > editor > viewer
const roleHierarchy: Record<UserRole, number> = {
  owner: 3,
  editor: 2,
  viewer: 1,
};

/**
 * RBAC Middleware
 * @param minRole - The minimum role required for this route (e.g., 'editor')
 * Expects `documentId` to be present in `req.params.id` or `req.params.documentId`
 */
export const checkRole = (minRole: UserRole) => {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { userId } = req;
      const documentId = req.params.id || req.params.documentId;

      if (!userId || !documentId) {
        return res.status(400).json({ message: 'Missing user or document context' });
      }

      // 1. Find the user's role for this document
      const member = await DocumentMember.findOne({ userId, documentId });

      if (!member) {
        return res.status(403).json({ message: 'Access denied: You are not a member of this document' });
      }

      // 2. Compare user's role against the required minimum role
      const userRoleLevel = roleHierarchy[member.role];
      const requiredRoleLevel = roleHierarchy[minRole];

      if (userRoleLevel < requiredRoleLevel) {
        return res.status(403).json({ 
          message: `Access denied: ${minRole} permissions required. You are a ${member.role}.` 
        });
      }

      // 3. Attach role to request for use in controllers if needed
      (req as any).userRole = member.role;
      next();
    } catch (error) {
      console.error('RBAC Error:', error);
      res.status(500).json({ message: 'Internal server error during permission check' });
    }
  };
};
