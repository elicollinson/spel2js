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
 * @author Ben March
 * @since 0.2.0
 */

import { SpelExpressionParser } from './SpelExpressionParser';
import { Stack } from './lib/Stack';

interface State {
    rootContext: any;
    activeContext: Stack;
    locals?: any;
}

interface CompiledExpression {
    getValue(state: State): any;
}

interface Evaluator {
    eval(context?: any, locals?: any): any;
    _compiledExpression: CompiledExpression;
}

const spelExpressionEvaluator = {};

function evalCompiled(compiledExpression: CompiledExpression, context: any, locals: any): any {
    const activeContext = new Stack();
    let state: State;

    if (!context) {
        context = {};
    }

    activeContext.push(context);

    state = {
        rootContext: context,
        activeContext: activeContext,
        locals: locals
    };
    return compiledExpression.getValue(state);
}

spelExpressionEvaluator.compile = function (expression: string): Evaluator {
    const compiledExpression = SpelExpressionParser().parse(expression);
    return {
        eval: function (context?: any, locals?: any): any {
            return evalCompiled(compiledExpression, context, locals);
        },
        _compiledExpression: compiledExpression
    };
};

spelExpressionEvaluator.eval = function (expression: string, context?: any, locals?: any): any {
    return spelExpressionEvaluator.compile(expression).eval(context, locals);
};

export { spelExpressionEvaluator as SpelExpressionEvaluator };
