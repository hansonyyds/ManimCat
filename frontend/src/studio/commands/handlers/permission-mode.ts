import type { StudioCommandContext, StudioPermissionModeCommand } from '../types'

export function executeStudioPermissionModeCommand(
  command: StudioPermissionModeCommand,
  context: StudioCommandContext,
) {
  context.setPendingMode(command.mode)
}

