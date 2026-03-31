import * as fs from 'fs';
import * as path from 'path';
import * as nls from 'vscode-nls';
import * as vscode from 'vscode';

import { isChildOf } from './qbsutils';
import { QbsSettings } from './qbssettings';

const localize = nls.config({ messageFormat: nls.MessageFormat.file })();

/** Context key for `when` clauses and `setContext`; must match package.json. */
export const QBS_WORKSPACE_SOLUTION_LOCKED_CONTEXT = 'qbs:workspaceSolutionLocked';

const workspaceFolderPlaceholder = '${workspaceFolder}';

let cachedLockedPath: string | undefined;
let cachedLocked = false;
let warnedNotSlnQbs = false;

const lockChangedEmitter = new vscode.EventEmitter<void>();
export const onWorkspaceSolutionLockChanged = lockChangedEmitter.event;

/** Trims `qbs.workspaceSolutionFile` (e.g. from folder or `.code-workspace` settings). */
export function trimWorkspaceSolutionSetting(vscodeSetting: string): string {
    return vscodeSetting.trim();
}

/** Replaces `${workspaceFolder}` with the first workspace folder path. */
export function expandWorkspaceFolderPlaceholder(raw: string, firstWorkspaceRoot: string): string {
    if (!raw.includes(workspaceFolderPlaceholder))
        return raw;
    return raw.split(workspaceFolderPlaceholder).join(firstWorkspaceRoot);
}

/** Resolves a candidate to a normalized absolute path (relative paths use first workspace root). */
export function resolveToAbsolutePath(expanded: string, firstWorkspaceRoot: string): string {
    const trimmed = expanded.trim();
    if (!trimmed)
        return trimmed;
    if (path.isAbsolute(trimmed))
        return path.normalize(trimmed);
    return path.normalize(path.resolve(firstWorkspaceRoot, trimmed));
}

/** True if the basename ends with `.sln.qbs` (case-insensitive). */
export function pathBasenameEndsWithSlnQbs(fsPath: string): boolean {
    return fsPath.toLowerCase().endsWith('.sln.qbs');
}

/** True if the absolute path lies under one of the workspace folder roots (or equals a root file). */
export function isAbsolutePathUnderWorkspaceRoots(absPath: string, workspaceFolderPaths: string[]): boolean {
    const norm = path.normalize(absPath);
    for (const root of workspaceFolderPaths) {
        const r = path.normalize(root);
        if (norm === r)
            return true;
        if (isChildOf(norm, r))
            return true;
    }
    return false;
}

function warnOnceIfExistsButNotSlnQbs(absPath: string): void {
    if (warnedNotSlnQbs || !fs.existsSync(absPath))
        return;
    if (pathBasenameEndsWithSlnQbs(absPath))
        return;
    warnedNotSlnQbs = true;
    void vscode.window.showWarningMessage(localize(
        'qbs.workspaceSolutionFile.invalidExtension.warning',
        'The workspace solution file setting must point to an *.sln.qbs file for workspace locking. The current path does not end with .sln.qbs; locking is disabled.',
    ));
}

/**
 * Computes the locked workspace solution absolute path, or undefined when not locked.
 * Lock requires: non-empty effective candidate, absolute path, file exists, .sln.qbs basename, under a workspace folder.
 */
export function computeLockedWorkspaceSolutionAbsolutePath(): string | undefined {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders?.length)
        return undefined;

    // TODO
    const candidate = trimWorkspaceSolutionSetting(QbsSettings.getWorkspaceSolutionFile());
    if (!candidate)
        return undefined;

    const firstRoot = folders[0].uri.fsPath;
    const expanded = expandWorkspaceFolderPlaceholder(candidate, firstRoot);
    const abs = resolveToAbsolutePath(expanded, firstRoot);
    if (!abs)
        return undefined;

    const workspaceRoots = folders.map(f => f.uri.fsPath);
    if (!isAbsolutePathUnderWorkspaceRoots(abs, workspaceRoots))
        return undefined;

    if (!fs.existsSync(abs))
        return undefined;

    if (!pathBasenameEndsWithSlnQbs(abs)) {
        warnOnceIfExistsButNotSlnQbs(abs);
        return undefined;
    }

    return abs;
}

export function getLockedWorkspaceSolutionPath(): string | undefined {
    return cachedLockedPath;
}

export function isWorkspaceSolutionLocked(): boolean {
    return cachedLocked;
}

export async function refreshWorkspaceSolutionLockContext(): Promise<void> {
    const nextPath = computeLockedWorkspaceSolutionAbsolutePath();
    const nextLocked = nextPath !== undefined;
    const changed = nextPath !== cachedLockedPath || nextLocked !== cachedLocked;
    cachedLockedPath = nextPath;
    cachedLocked = nextLocked;

    await vscode.commands.executeCommand('setContext', QBS_WORKSPACE_SOLUTION_LOCKED_CONTEXT, nextLocked);
    if (changed)
        lockChangedEmitter.fire();
}
