import { UtamBaseRootPageObject as _UtamBaseRootPageObject } from '@utam/core';

export default class Feed extends _UtamBaseRootPageObject {
    getPosts(): Promise<string[]>;
}
