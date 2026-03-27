import { expect } from 'chai';

import {
    expandWorkspaceFolderPlaceholder,
    isAbsolutePathUnderWorkspaceRoots,
    pathBasenameEndsWithSlnQbs,
    resolveToAbsolutePath,
    trimWorkspaceSolutionSetting,
} from '../../qbsworkspacesolution';

suite('Workspace solution lock helpers', () => {

    test('trimWorkspaceSolutionSetting', () => {
        expect(trimWorkspaceSolutionSetting('  /a/b.sln.qbs  ')).to.eq('/a/b.sln.qbs');
        expect(trimWorkspaceSolutionSetting('')).to.eq('');
    });

    test('expandWorkspaceFolderPlaceholder replaces token', () => {
        expect(expandWorkspaceFolderPlaceholder('${workspaceFolder}/p.sln.qbs', '/ws'))
            .to.eq('/ws/p.sln.qbs');
        expect(expandWorkspaceFolderPlaceholder('abs', '/ws')).to.eq('abs');
    });

    test('resolveToAbsolutePath', () => {
        expect(resolveToAbsolutePath('/abs/x.sln.qbs', '/ws')).to.eq('/abs/x.sln.qbs');
        expect(resolveToAbsolutePath('sub/p.sln.qbs', '/ws')).to.eq('/ws/sub/p.sln.qbs');
    });

    test('pathBasenameEndsWithSlnQbs is case-insensitive', () => {
        expect(pathBasenameEndsWithSlnQbs('/a/B.SLN.QBS')).to.eq(true);
        expect(pathBasenameEndsWithSlnQbs('/a/project.qbs')).to.eq(false);
    });

    test('isAbsolutePathUnderWorkspaceRoots', () => {
        const roots = ['/home/proj'];
        expect(isAbsolutePathUnderWorkspaceRoots('/home/proj/foo/bar.sln.qbs', roots)).to.eq(true);
        expect(isAbsolutePathUnderWorkspaceRoots('/home/proj', roots)).to.eq(true);
        expect(isAbsolutePathUnderWorkspaceRoots('/other/x.sln.qbs', roots)).to.eq(false);
    });
});
