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
 * @author Juergen Hoeller
 * @author Ben March
 * @since 0.2.0
 *
 */

import { TokenKind } from './TokenKind';
import { Tokenizer } from './Tokenizer';
import { BooleanLiteral } from './ast/BooleanLiteral';
import { NumberLiteral } from './ast/NumberLiteral';
import { StringLiteral } from './ast/StringLiteral';
import { NullLiteral } from './ast/NullLiteral';
import { FunctionReference } from './ast/FunctionReference';
import { MethodReference } from './ast/MethodReference';
import { PropertyReference } from './ast/PropertyReference';
import { VariableReference } from './ast/VariableReference';
import { CompoundExpression } from './ast/CompoundExpression';
import { Indexer } from './ast/Indexer';
import { Assign } from './ast/Assign';
import { OpEQ } from './ast/OpEQ';
import { OpNE } from './ast/OpNE';
import { OpGE } from './ast/OpGE';
import { OpGT } from './ast/OpGT';
import { OpLE } from './ast/OpLE';
import { OpLT } from './ast/OpLT';
import { OpPlus } from './ast/OpPlus';
import { OpMinus } from './ast/OpMinus';
import { OpMultiply } from './ast/OpMultiply';
import { OpDivide } from './ast/OpDivide';
import { OpModulus } from './ast/OpModulus';
import { OpPower } from './ast/OpPower';
import { OpInc } from './ast/OpInc';
import { OpDec } from './ast/OpDec';
import { OpNot } from './ast/OpNot';
import { OpAnd } from './ast/OpAnd';
import { OpOr } from './ast/OpOr';
import { OpMatches } from './ast/OpMatches';
import { Ternary } from './ast/Ternary';
import { Elvis } from './ast/Elvis';
import { InlineList } from './ast/InlineList';
import { InlineMap } from './ast/InlineMap';
import { Selection } from './ast/Selection';
import { Projection } from './ast/Projection';

//not yet implemented
import { OpInstanceof } from './ast/OpInstanceof';
import { OpBetween } from './ast/OpBetween';
import { TypeReference } from './ast/TypeReference';
import { BeanReference } from './ast/BeanReference';
import { Identifier } from './ast/Identifier';
import { QualifiedIdentifier } from './ast/QualifiedIdentifier';
import { ConstructorReference } from './ast/ConstructorReference';

export const SpelExpressionParser = function () {
    const VALID_QUALIFIED_ID_PATTERN = new RegExp('[\\p{L}\\p{N}_$]+');

    let configuration: any;

    // For rules that build nodes, they are stacked here for return
    let constructedNodes: any[] = [];

    // The expression being parsed
    let expressionString: string;

    // The token stream constructed from that expression string
    let tokenStream: any[];

    // length of a populated token stream
    let tokenStreamLength: number;

    // Current location in the token stream when processing tokens
    let tokenStreamPointer: number;

    /**
     * Create a parser with some configured behavior.
     * @param config custom configuration options
     */
    function setConfiguration(config: any) {
        configuration = config;
    }

    function parse(expression: string, context?: any) {
        try {
            expressionString = expression;
            tokenStream = Tokenizer.tokenize(expression);
            tokenStreamLength = tokenStream.length;
            tokenStreamPointer = 0;
            constructedNodes = [];
            const ast = eatExpression();
            if (moreTokens()) {
                raiseInternalException(peekToken().startPos, 'MORE_INPUT', nextToken().toString());
            }
            return ast;
        } catch (e) {
            throw e.message;
        }
    }

    function eatExpression(): any {
        let expr = eatLogicalOrExpression();
        if (moreTokens()) {
            const token = peekToken();
            if (token.getKind() === TokenKind.ASSIGN) {
                if (expr === null) {
                    expr = NullLiteral.create(toPosBounds(token.startPos - 1, token.endPos - 1));
                }
                nextToken();
                const assignedValue = eatLogicalOrExpression();
                return Assign.create(toPosToken(token), expr, assignedValue);
            }

            if (token.getKind() === TokenKind.ELVIS) {
                if (expr === null) {
                    expr = NullLiteral.create(toPosBounds(token.startPos - 1, token.endPos - 2));
                }
                nextToken();
                const valueIfNull = eatExpression();
                if (valueIfNull === null) {
                    valueIfNull = NullLiteral.create(toPosBounds(token.startPos + 1, token.endPos + 1));
                }
                return Elvis.create(toPosToken(token), expr, valueIfNull);
            }

            if (token.getKind() === TokenKind.QMARK) {
                if (expr === null) {
                    expr = NullLiteral.create(toPosBounds(token.startPos - 1, token.endPos - 1));
                }
                nextToken();
                const ifTrueExprValue = eatExpression();
                eatToken(TokenKind.COLON);
                const ifFalseExprValue = eatExpression();
                return Ternary.create(toPosToken(token), expr, ifTrueExprValue, ifFalseExprValue);
            }
        }
        return expr;
    }

    function eatLogicalOrExpression(): any {
        let expr = eatLogicalAndExpression();
        while (peekIdentifierToken('or') || peekTokenOne(TokenKind.SYMBOLIC_OR)) {
            const token = nextToken();
            const rhExpr = eatLogicalAndExpression();
            checkOperands(token, expr, rhExpr);
            expr = OpOr.create(toPosToken(token), expr, rhExpr);
        }
        return expr;
    }

    function eatLogicalAndExpression(): any {
        let expr = eatRelationalExpression();
        while (peekIdentifierToken('and') || peekTokenOne(TokenKind.SYMBOLIC_AND)) {
            const token = nextToken();
            const rhExpr = eatRelationalExpression();
            checkOperands(token, expr, rhExpr);
            expr = OpAnd.create(toPosToken(token), expr, rhExpr);
        }
        return expr;
    }

    function eatRelationalExpression(): any {
        let expr = eatSumExpression();
        const relationalOperatorToken = maybeEatRelationalOperator();
        if (relationalOperatorToken !== null) {
            const token = nextToken();
            const rhExpr = eatSumExpression();
            checkOperands(token, expr, rhExpr);
            const tk = relationalOperatorToken.kind;

            if (relationalOperatorToken.isNumericRelationalOperator()) {
                const pos = toPosToken(token);
                if (tk === TokenKind.GT) {
                    return OpGT.create(pos, expr, rhExpr);
                }
                if (tk === TokenKind.LT) {
                    return OpLT.create(pos, expr, rhExpr);
                }
                if (tk === TokenKind.LE) {
                    return OpLE.create(pos, expr, rhExpr);
                }
                if (tk === TokenKind.GE) {
                    return OpGE.create(pos, expr, rhExpr);
                }
                if (tk === TokenKind.EQ) {
                    return OpEQ.create(pos, expr, rhExpr);
                }
                return OpNE.create(pos, expr, rhExpr);
            }

            if (tk === TokenKind.INSTANCEOF) {
                return OpInstanceof.create(toPosToken(token), expr, rhExpr);
            }

            if (tk === TokenKind.MATCHES) {
                return OpMatches.create(toPosToken(token), expr, rhExpr);
            }

            return OpBetween.create(toPosToken(token), expr, rhExpr);
        }
        return expr;
    }

    function eatSumExpression(): any {
        let expr = eatProductExpression();
        while (peekTokenAny(TokenKind.PLUS, TokenKind.MINUS, TokenKind.INC)) {
            const token = nextToken();
            const rhExpr = eatProductExpression();
            checkRightOperand(token, rhExpr);
            if (token.getKind() === TokenKind.PLUS) {
                expr = OpPlus.create(toPosToken(token), expr, rhExpr);
            } else if (token.getKind() === TokenKind.MINUS) {
                expr = OpMinus.create(toPosToken(token), expr, rhExpr);
            }
        }
        return expr;
    }

    function eatProductExpression(): any {
        let expr = eatPowerIncDecExpression();
        while (peekTokenAny(TokenKind.STAR, TokenKind.DIV, TokenKind.MOD)) {
            const token = nextToken();
            const rhExpr = eatPowerIncDecExpression();
            checkOperands(token, expr, rhExpr);
            if (token.getKind() === TokenKind.STAR) {
                expr = OpMultiply.create(toPosToken(token), expr, rhExpr);
            } else if (token.getKind() === TokenKind.DIV) {
                expr = OpDivide.create(toPosToken(token), expr, rhExpr);
            } else {
                expr = OpModulus.create(toPosToken(token), expr, rhExpr);
            }
        }
        return expr;
    }

    function eatPowerIncDecExpression(): any {
        let expr = eatUnaryExpression();
        let token;

        if (peekTokenOne(TokenKind.POWER)) {
            token = nextToken();
            const rhExpr = eatUnaryExpression();
            checkRightOperand(token, rhExpr);
            return OpPower.create(toPosToken(token), expr, rhExpr);
        }

        if (expr !== null && peekTokenAny(TokenKind.INC, TokenKind.DEC)) {
            token = nextToken();
            if (token.getKind() === TokenKind.INC) {
                return OpInc.create(toPosToken(token), true, expr);
            }
            return OpDec.create(toPosToken(token), true, expr);
        }

        return expr;
    }

    function eatUnaryExpression(): any {
        let token;
        let expr;

        if (peekTokenAny(TokenKind.PLUS, TokenKind.MINUS, TokenKind.NOT)) {
            token = nextToken();
            expr = eatUnaryExpression();
            if (token.getKind() === TokenKind.NOT) {
                return OpNot.create(toPosToken(token), expr);
            }

            if (token.getKind() === TokenKind.PLUS) {
                return OpPlus.create(toPosToken(token), expr);
            }
            return OpMinus.create(toPosToken(token), expr);
        }
        if (peekTokenAny(TokenKind.INC, TokenKind.DEC)) {
            token = nextToken();
            expr = eatUnaryExpression();
            if (token.getKind() === TokenKind.INC) {
                return OpInc.create(toPosToken(token), false, expr);
            }
            return OpDec.create(toPosToken(token), false, expr);
        }

        return eatPrimaryExpression();
    }

    function eatPrimaryExpression(): any {
        const nodes = [];
        const start = eatStartNode();
        nodes.push(start);
        while (maybeEatNode()) {
            nodes.push(pop());
        }
        if (nodes.length === 1) {
            return nodes[0];
        }
        return CompoundExpression.create(toPosBounds(start.getStartPosition(), nodes[nodes.length - 1].getEndPosition()), nodes);
    }

    function maybeEatNode(): boolean {
        let expr = null;
        if (peekTokenAny(TokenKind.DOT, TokenKind.SAFE_NAVI)) {
            expr = eatDottedNode();
        } else {
            expr = maybeEatNonDottedNode();
        }

        if (expr === null) {
            return false;
        } else {
            push(expr);
            return true;
        }
    }

    function maybeEatNonDottedNode(): any {
        if (peekTokenOne(TokenKind.LSQUARE)) {
            if (maybeEatIndexer()) {
                return pop();
            }
        }
        return null;
    }

    function eatDottedNode(): any {
        const token = nextToken();
        const nullSafeNavigation = token.getKind() === TokenKind.SAFE_NAVI;
        if (maybeEatMethodOrProperty(nullSafeNavigation) || maybeEatFunctionOrVar() || maybeEatProjection(nullSafeNavigation) || maybeEatSelection(nullSafeNavigation)) {
            return pop();
        }
        if (peekToken() === null) {
            raiseInternalException(token.startPos, 'OOD');
        } else {
            raiseInternalException(token.startPos, 'UNEXPECTED_DATA_AFTER_DOT', toString(peekToken()));
        }
        return null;
    }

    function maybeEatFunctionOrVar(): boolean {
        if (!peekTokenOne(TokenKind.HASH)) {
            return false;
        }
        const token = nextToken();
        const functionOrVariableName = eatToken(TokenKind.IDENTIFIER);
        const args = maybeEatMethodArgs();
        if (args === null) {
            push(VariableReference.create(functionOrVariableName.data, toPosBounds(token.startPos, functionOrVariableName.endPos)));
            return true;
        }

        push(FunctionReference.create(functionOrVariableName.data, toPosBounds(token.startPos, functionOrVariableName.endPos), args));
        return true;
    }

    function maybeEatMethodArgs(): any[] | null {
        if (!peekTokenOne(TokenKind.LPAREN)) {
            return null;
        }
        const args: any[] = [];
        consumeArguments(args);
        eatToken(TokenKind.RPAREN);
        return args;
    }

    function eatConstructorArgs(accumulatedArguments: any[]): void {
        if (!peekTokenOne(TokenKind.LPAREN)) {
            raiseInternalException(toPosToken(peekToken()), 'MISSING_CONSTRUCTOR_ARGS');
        }
        consumeArguments(accumulatedArguments);
        eatToken(TokenKind.RPAREN);
    }

    function consumeArguments(accumulatedArguments: any[]): void {
        const pos = peekToken().startPos;
        let next;
        do {
            nextToken();
            const token = peekToken();
            if (token === null) {
                raiseInternalException(pos, 'RUN_OUT_OF_ARGUMENTS');
            }
            if (token.getKind() !== TokenKind.RPAREN) {
                accumulatedArguments.push(eatExpression());
            }
            next = peekToken();
        } while (next !== null && next.kind === TokenKind.COMMA);

        if (next === null) {
            raiseInternalException(pos, 'RUN_OUT_OF_ARGUMENTS');
        }
    }

    function positionOf(token: any): number {
        if (token === null) {
            return expressionString.length;
        }
        return token.startPos;
    }

    function eatStartNode(): any {
        if (maybeEatLiteral()) {
            return pop();
        } else if (maybeEatParenExpression()) {
            return pop();
        } else if (maybeEatTypeReference() || maybeEatNullReference() || maybeEatConstructorReference() || maybeEatMethodOrProperty(false) || maybeEatFunctionOrVar()) {
            return pop();
        } else if (maybeEatBeanReference()) {
            return pop();
        } else if (maybeEatProjection(false) || maybeEatSelection(false) || maybeEatIndexer()) {
            return pop();
        } else if (maybeEatInlineListOrMap()) {
            return pop();
        } else {
            return null;
        }
    }

    function maybeEatBeanReference(): boolean {
        if (peekTokenOne(TokenKind.BEAN_REF)) {
            const beanRefToken = nextToken();
            let beanNameToken = null;
            let beanName = null;
            if (peekTokenOne(TokenKind.IDENTIFIER)) {
                beanNameToken = eatToken(TokenKind.IDENTIFIER);
                beanName = beanNameToken.data;
            } else if (peekTokenOne(TokenKind.LITERAL_STRING)) {
                beanNameToken = eatToken(TokenKind.LITERAL_STRING);
                beanName = beanNameToken.stringValue();
                beanName = beanName.substring(1, beanName.length() - 1);
            } else {
                raiseInternalException(beanRefToken.startPos, 'INVALID_BEAN_REFERENCE');
            }

            const beanReference = BeanReference.create(toPosToken(beanNameToken), beanName);
            push(beanReference);
            return true;
        }
        return false;
    }

    function maybeEatTypeReference(): boolean {
        if (peekTokenOne(TokenKind.IDENTIFIER)) {
            const typeName = peekToken();
            if (typeName.stringValue() !== 'T') {
                return false;
            }
            const token = nextToken();
            if (peekTokenOne(TokenKind.RSQUARE)) {
                push(PropertyReference.create(token.stringValue(), toPosToken(token)));
                return true;
            }
            eatToken(TokenKind.LPAREN);
            const node = eatPossiblyQualifiedId();
            let dims = 0;
            while (peekTokenConsumeIfMatched(TokenKind.LSQUARE, true)) {
                eatToken(TokenKind.RSQUARE);
                dims++;
            }
            eatToken(TokenKind.RPAREN);
            push(TypeReference.create(toPosToken(typeName), node, dims));
            return true;
        }
        return false;
    }

    function maybeEatNullReference(): boolean {
        if (peekTokenOne(TokenKind.IDENTIFIER)) {
            const nullToken = peekToken();
            if (nullToken.stringValue().toLowerCase() !== 'null') {
                return false;
            }
            nextToken();
            push(NullLiteral.create(toPosToken(nullToken)));
            return true;
        }
        return false;
    }

    function maybeEatProjection(nullSafeNavigation: boolean): boolean {
        const token = peekToken();
        if (!peekTokenConsumeIfMatched(TokenKind.PROJECT, true)) {
            return false;
        }
        const expr = eatExpression();
        eatToken(TokenKind.RSQUARE);
        push(Projection.create(nullSafeNavigation, toPosToken(token), expr));
        return true;
    }

    function maybeEatInlineListOrMap(): boolean {
        const token = peekToken();
        const listElements: any[] = [];

        if (!peekTokenConsumeIfMatched(TokenKind.LCURLY, true)) {
            return false;
        }
        let expr = null;
        let closingCurly = peekToken();
        if (peekTokenConsumeIfMatched(TokenKind.RCURLY, true)) {
            expr = InlineList.create(toPosBounds(token.startPos, closingCurly.endPos));
        } else if (peekTokenConsumeIfMatched(TokenKind.COLON, true)) {
            closingCurly = eatToken(TokenKind.RCURLY);
            expr = InlineMap.create(toPosBounds(token.startPos, closingCurly.endPos));
        } else {
            const firstExpression = eatExpression();
            if (peekTokenOne(TokenKind.RCURLY)) {
                listElements.push(firstExpression);
                closingCurly = eatToken(TokenKind.RCURLY);
                expr = InlineList.create(toPosBounds(token.startPos, closingCurly.endPos), listElements);
            } else if (peekTokenConsumeIfMatched(TokenKind.COMMA, true)) {
                listElements.push(firstExpression);
                do {
                    listElements.push(eatExpression());
                } while (peekTokenConsumeIfMatched(TokenKind.COMMA, true));
                closingCurly = eatToken(TokenKind.RCURLY);
                expr = InlineList.create(toPosToken(token.startPos, closingCurly.endPos), listElements);
            } else if (peekTokenConsumeIfMatched(TokenKind.COLON, true)) {
                const mapElements: any[] = [];
                mapElements.push(firstExpression);
                mapElements.push(eatExpression());
                while (peekTokenConsumeIfMatched(TokenKind.COMMA, true)) {
                    mapElements.push(eatExpression());
                    eatToken(TokenKind.COLON);
                    mapElements.push(eatExpression());
                }
                closingCurly = eatToken(TokenKind.RCURLY);
                expr = InlineMap.create(toPosBounds(token.startPos, closingCurly.endPos), mapElements);
            } else {
                raiseInternalException(token.startPos, 'OOD');
            }
        }
        push(expr);
        return true;
    }

    function maybeEatIndexer(): boolean {
        const token = peekToken();
        if (!peekTokenConsumeIfMatched(TokenKind.LSQUARE, true)) {
            return false;
        }
        const expr = eatExpression();
        eatToken(TokenKind.RSQUARE);
        push(Indexer.create(toPosToken(token), expr));
        return true;
    }

    function maybeEatSelection(nullSafeNavigation: boolean): boolean {
        const token = peekToken();
        if (!peekSelectToken()) {
            return false;
        }
        nextToken();
        const expr = eatExpression();
        if (expr === null) {
            raiseInternalException(toPosToken(token), 'MISSING_SELECTION_EXPRESSION');
        }
        eatToken(TokenKind.RSQUARE);
        if (token.getKind() === TokenKind.SELECT_FIRST) {
            push(Selection.create(nullSafeNavigation, Selection.FIRST, toPosToken(token), expr));
        } else if (token.getKind() === TokenKind.SELECT_LAST) {
            push(Selection.create(nullSafeNavigation, Selection.LAST, toPosToken(token), expr));
        } else {
            push(Selection.create(nullSafeNavigation, Selection.ALL, toPosToken(token), expr));
        }
        return true;
    }

    function eatPossiblyQualifiedId(): any {
        const qualifiedIdPieces: any[] = [];
        let node = peekToken();
        while (isValidQualifiedId(node)) {
            nextToken();
            if (node.kind !== TokenKind.DOT) {
                qualifiedIdPieces.push(Identifier.create(node.stringValue(), toPosToken(node)));
            }
            node = peekToken();
        }
        if (!qualifiedIdPieces.length) {
            if (node === null) {
                raiseInternalException(expressionString.length, 'OOD');
            }
            raiseInternalException(node.startPos, 'NOT_EXPECTED_TOKEN', 'qualified ID', node.getKind().toString().toLowerCase());
        }
        const pos = toPosBounds(qualifiedIdPieces[0].getStartPosition(), qualifiedIdPieces[qualifiedIdPieces.length - 1].getEndPosition());
        return QualifiedIdentifier.create(pos, qualifiedIdPieces);
    }

    function isValidQualifiedId(node: any): boolean {
        if (node === null || node.kind === TokenKind.LITERAL_STRING) {
            return false;
        }
        if (node.kind === TokenKind.DOT || node.kind === TokenKind.IDENTIFIER) {
            return true;
        }
        const value = node.stringValue();
        return value && value.length && VALID_QUALIFIED_ID_PATTERN.test(value);
    }

    function maybeEatMethodOrProperty(nullSafeNavigation: boolean): boolean {
        if (peekTokenOne(TokenKind.IDENTIFIER)) {
            const methodOrPropertyName = nextToken();
            const args = maybeEatMethodArgs();
            if (args === null) {
                push(PropertyReference.create(nullSafeNavigation, methodOrPropertyName.stringValue(), toPosToken(methodOrPropertyName)));
                return true;
            }
            push(MethodReference.create(nullSafeNavigation, methodOrPropertyName.stringValue(), toPosToken(methodOrPropertyName), args));
            return true;
        }
        return false;
    }

    function maybeEatConstructorReference(): boolean {
        if (peekIdentifierToken('new')) {
            const newToken = nextToken();
            if (peekTokenOne(TokenKind.RSQUARE)) {
                push(PropertyReference.create(newToken.stringValue(), toPosToken(newToken)));
                return true;
            }
            const possiblyQualifiedConstructorName = eatPossiblyQualifiedId();
            const nodes: any[] = [];
            nodes.push(possiblyQualifiedConstructorName);
            if (peekTokenOne(TokenKind.LSQUARE)) {
                const dimensions: any[] = [];
                while (peekTokenConsumeIfMatched(TokenKind.LSQUARE, true)) {
                    if (!peekTokenOne(TokenKind.RSQUARE)) {
                        dimensions.push(eatExpression());
                    } else {
                        dimensions.push(null);
                    }
                    eatToken(TokenKind.RSQUARE);
                }
                if (maybeEatInlineListOrMap()) {
                    nodes.push(pop());
                }
                push(ConstructorReference.create(toPosToken(newToken), dimensions, nodes));
            } else {
                eatConstructorArgs(nodes);
                push(ConstructorReference.create(toPosToken(newToken), nodes));
            }
            return true;
        }
        return false;
    }

    function push(newNode: any): void {
        constructedNodes.push(newNode);
    }

    function pop(): any {
        return constructedNodes.pop();
    }

    function maybeEatLiteral(): boolean {
        const token = peekToken();
        if (token === null) {
            return false;
        }
        if (token.getKind() === TokenKind.LITERAL_INT || token.getKind() === TokenKind.LITERAL_LONG) {
            push(NumberLiteral.create(parseInt(token.stringValue(), 10), toPosToken(token)));
        } else if (token.getKind() === TokenKind.LITERAL_REAL || token.getKind() === TokenKind.LITERAL_REAL_FLOAT) {
            push(NumberLiteral.create(parseFloat(token.stringValue()), toPosToken(token)));
        } else if (token.getKind() === TokenKind.LITERAL_HEXINT || token.getKind() === TokenKind.LITERAL_HEXLONG) {
            push(NumberLiteral.create(parseInt(token.stringValue(), 16), toPosToken(token)));
        } else if (peekIdentifierToken('true')) {
            push(BooleanLiteral.create(true, toPosToken(token)));
        } else if (peekIdentifierToken('false')) {
            push(BooleanLiteral.create(false, toPosToken(token)));
        } else if (token.getKind() === TokenKind.LITERAL_STRING) {
            push(StringLiteral.create(token.stringValue(), toPosToken(token)));
        } else {
            return false;
        }
        nextToken();
        return true;
    }

    function maybeEatParenExpression(): boolean {
        if (peekTokenOne(TokenKind.LPAREN)) {
            nextToken();
            const expr = eatExpression();
            eatToken(TokenKind.RPAREN);
            push(expr);
            return true;
        } else {
            return false;
        }
    }

    function maybeEatRelationalOperator(): any {
        const token = peekToken();
        if (token === null) {
            return null;
        }
        if (token.isNumericRelationalOperator()) {
            return token;
        }
        if (token.isIdentifier()) {
            const idString = token.stringValue();
            if (idString.toLowerCase() === 'instanceof') {
                return token.asInstanceOfToken();
            }
            if (idString.toLowerCase() === 'matches') {
                return token.asMatchesToken();
            }
            if (idString.toLowerCase() === 'between') {
                return token.asBetweenToken();
            }
        }
        return null;
    }

    function eatToken(expectedKind: any): any {
        const token = nextToken();
        if (token === null) {
            raiseInternalException(expressionString.length, 'OOD');
        }
        if (token.getKind() !== expectedKind) {
            raiseInternalException(token.startPos, 'NOT_EXPECTED_TOKEN', expectedKind.toString().toLowerCase(), token.getKind().toString().toLowerCase());
        }
        return token;
    }

    function peekTokenOne(desiredTokenKind: any): boolean {
        return peekTokenConsumeIfMatched(desiredTokenKind, false);
    }

    function peekTokenConsumeIfMatched(desiredTokenKind: any, consumeIfMatched: boolean): boolean {
        if (!moreTokens()) {
            return false;
        }
        const token = peekToken();
        if (token.getKind() === desiredTokenKind) {
            if (consumeIfMatched) {
                tokenStreamPointer++;
            }
            return true;
        }

        if (desiredTokenKind === TokenKind.IDENTIFIER) {
            if (token.getKind().ordinal() >= TokenKind.DIV.ordinal() && token.getKind().ordinal() <= TokenKind.NOT.ordinal() && token.data !== null) {
                return true;
            }
        }
        return false;
    }

    function peekTokenAny(...args: any[]): boolean {
        if (!moreTokens()) {
            return false;
        }
        const token = peekToken();
        for (let i = 0, l = args.length; i < l; i += 1) {
            if (token.getKind() === args[i]) {
                return true;
            }
        }
        return false;
    }

    function peekIdentifierToken(identifierString: string): boolean {
        if (!moreTokens()) {
            return false;
        }
        const token = peekToken();
        return token.getKind() === TokenKind.IDENTIFIER && token.stringValue().toLowerCase() === identifierString.toLowerCase();
    }

    function peekSelectToken(): boolean {
        if (!moreTokens()) {
            return false;
        }
        const token = peekToken();
        return token.getKind() === TokenKind.SELECT || token.getKind() === TokenKind.SELECT_FIRST || token.getKind() === TokenKind.SELECT_LAST;
    }

    function moreTokens(): boolean {
        return tokenStreamPointer < tokenStream.length;
    }

    function nextToken(): any {
        if (tokenStreamPointer >= tokenStreamLength) {
            return null;
        }
        return tokenStream[tokenStreamPointer++];
    }

    function peekToken(): any {
        if (tokenStreamPointer >= tokenStreamLength) {
            return null;
        }
        return tokenStream[tokenStreamPointer];
    }

    function raiseInternalException(pos: number, message: string, expected?: string, actual?: string): void {
        if (expected) {
            message += '\nExpected: ' + expected;
        }
        if (actual) {
            message += '\nActual: ' + actual;
        }
        throw {
            name: 'InternalParseException',
            message: 'Error occurred while attempting to parse expression \'' + expressionString + '\' at position ' + pos + '. Message: ' + message
        };
    }

    function toString(token: any): string {
        if (token.getKind().hasPayload()) {
            return token.stringValue();
        }
        return token.getKind().toString().toLowerCase();
    }

    function checkOperands(token: any, left: any, right: any): void {
        checkLeftOperand(token, left);
        checkRightOperand(token, right);
    }

    function checkLeftOperand(token: any, operandExpression: any): void {
        if (operandExpression === null) {
            raiseInternalException(token.startPos, 'LEFT_OPERAND_PROBLEM');
        }
    }

    function checkRightOperand(token: any, operandExpression: any): void {
        if (operandExpression === null) {
            raiseInternalException(token.startPos, 'RIGHT_OPERAND_PROBLEM');
        }
    }

    function toPosToken(token: any): number {
        return (token.startPos << 16) + token.endPos;
    }

    function toPosBounds(start: number, end: number): number {
        return (start << 16) + end;
    }

    return {
        setConfiguration: setConfiguration,
        parse: parse
    };
};
