/*
 * Copyright 2002-2015 the original author or authors.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * @author Andy Clement
 * @author Ben March
 * @since 0.2.0
 */

import { TokenKind } from './TokenKind';

class Token {
    kind: TokenKind;
    startPos: number;
    endPos: number;
    data?: string;

    constructor(tokenKind: TokenKind, startPos: number, endPos: number, tokenData?: string) {
        this.kind = tokenKind;
        this.startPos = startPos;
        this.endPos = endPos;
        if (tokenData) {
            this.data = tokenData;
        }
    }

    getKind(): TokenKind {
        return this.kind;
    }

    toString(): string {
        let s = '[';
        s += this.kind.toString();
        if (this.kind.hasPayload()) {
            s += ':' + this.data;
        }
        s += ']';
        s += '(' + this.startPos + ',' + this.endPos + ')';
        return s;
    }

    isIdentifier(): boolean {
        return this.kind === TokenKind.IDENTIFIER;
    }

    isNumericRelationalOperator(): boolean {
        return (
            this.kind === TokenKind.GT ||
            this.kind === TokenKind.GE ||
            this.kind === TokenKind.LT ||
            this.kind === TokenKind.LE ||
            this.kind === TokenKind.EQ ||
            this.kind === TokenKind.NE
        );
    }

    stringValue(): string | undefined {
        return this.data;
    }

    asInstanceOfToken(): Token {
        return new Token(TokenKind.INSTANCEOF, this.startPos, this.endPos);
    }

    asMatchesToken(): Token {
        return new Token(TokenKind.MATCHES, this.startPos, this.endPos);
    }

    asBetweenToken(): Token {
        return new Token(TokenKind.BETWEEN, this.startPos, this.endPos);
    }

    getStartPosition(): number {
        return this.startPos;
    }

    getEndPosition(): number {
        return this.endPos;
    }
}

export { Token };
