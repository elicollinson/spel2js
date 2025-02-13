/*
 * Copyright 2002-2019 the original author or authors.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {SpelNode} from './SpelNode.js';

/**
 * Represents a bean reference to a type, for example <tt>@foo</tt> or <tt>@'foo.bar'</tt>.
 * For a FactoryBean the syntax <tt>&foo</tt> can be used to access the factory itself.
 *
 * @author Andy Clement
 */
function createNode(position, beanName) {
    var node = SpelNode.create('beanref', position);

    node.getValue = function (state) {
        throw {
            name: 'MethodNotImplementedException',
            message: 'BeanReference: Not implemented'
        }
    };

    return node;
}

export var BeanReference =  {
    create: createNode
};
