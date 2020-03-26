'use strict';

/** @namespace extend-me **/

/** @summary Extends an existing "class" (constructor function) into a new "subclass.
 *
 * @returns {function} A new class (constructor function), extended from the class provided in the execution context, possibly with some prototype additions.
 *
 * @desc Extends a class creating a subclass with optional prototype additions.
 *
 * > CAVEAT: Not to be confused with Underscore-style .extend() which is something else entirely. I've used the name "extend" here because other packages (like Backbone.js) use it this way. You are free to call it whatever you want when you "require" it, such as `var inherits = require('extend')`.
 *
 * Provide any prototype additions you require in the first argument, including optional constructor code in a method called `initialize`.
 *
 * For example, if you wish to be able to extend your class `MyBase` to a new "class" (i.e., constructor function) with prototype overrides and/or additions, basic usage is:
 *
 * ```javascript
 * function MyBase() { ... }
 * MyBase.prototype = { ... };
 * MyBase.extend = extend; // mix in .extend
 * var MyChild = MyBase.extend(childPrototypeOverridesAndAdditions);
 * var MyGrandchild = MyChild.extend(grandchildPrototypeOverridesAndAdditions);
 * ```
 *
 * This `extend` function is automatically added to the new extended class (constructor function) as a static property so it will itself be "extendable."
 *
 * @this Function - The base class (constructor function) being extended from.
 *
 * @param {string} [extendedClassName=prototypeAdditions.$$CLASS_NAME || prototypeAdditions.name] - If defined, added to the constructor as static `name` property; and to the prototype as `$$CLASS_NAME`. Useful for debugging because all derived constructors appear to have the same name (`Constructor`) in the debugger. (If omitted, 2nd parameter is promoted to first position.)
 *
 * @param {prototypeAdditionsObject} [prototypeAdditions] - Object with members to define in the new constructor's prototype.
 *
 * @memberOf extend-me
 */
function extend(extendedClassName, prototypeAdditions) {
    switch (arguments.length) {
        case 0:
            prototypeAdditions = {};
            break;
        case 1:
            switch (typeof extendedClassName) {
                case 'object':
                    prototypeAdditions = extendedClassName;
                    extendedClassName = undefined;
                    break;
                case 'string':
                    prototypeAdditions = {};
                    break;
                default:
                    throw 'Single-parameter overload must be either string or object.';
            }
            break;
        case 2:
            if (typeof extendedClassName !== 'string' || typeof prototypeAdditions !== 'object') {
                throw 'Two-parameter overload must be string, object.';
            }
            break;
        default:
            throw 'Too many parameters';
    }

    /**
     * @class
     */
    function Constructor() {
        if (this.preInitialize) {
            this.preInitialize.apply(this, arguments);
        }

        initializePrototypeChain.apply(this, arguments);

        if (this.postInitialize) {
            this.postInitialize.apply(this, arguments);
        }
    }

    /**
     * @method
     * @see {@link extend-me.extend}
     * @desc Added to each returned extended class constructor.
     */
    Constructor.extend = extend;

    Constructor.getClassName = getClassName;

    /**
     * @method
     * @param {string} [ancestorConstructorName] - If given, searches up the prototype chain for constructor with matching name.
     * @returns {function|null} Constructor of parent class; or ancestor class with matching name; or null
     */
    Constructor.parent = parentConstructor;

    var prototype = Constructor.prototype = Object.create(this.prototype);
    prototype.constructor = Constructor;

    extendedClassName = extendedClassName || prototype.$$CLASS_NAME || prototype.name;
    if (extendedClassName) {
        Object.defineProperty(Constructor, 'name', { value: extendedClassName, configurable: true });
        prototype.$$CLASS_NAME = extendedClassName;
    }

    // define each prototype addition on the prototype (including getter/setters)
    var key, descriptor;
    for (key in prototypeAdditions) {
        if ((descriptor = Object.getOwnPropertyDescriptor(prototypeAdditions, key))) {
            Object.defineProperty(prototype, key, descriptor);
        }
    }

    if (typeof this.postExtend === 'function') {
        this.postExtend(prototype);
    }

    return Constructor;
}

function Base() {}
Base.prototype = {

    constructor: Base.prototype.constructor,

    getClassName: function() {
        return (
            this.$$CLASS_NAME ||
            this.name ||
            this.constructor.name // try Function.prototype.name as last resort
        );
    },

    /**
     * Access a member of the super class.
     * @returns {Object}
     */
    get super() {
        return Object.getPrototypeOf(Object.getPrototypeOf(this));
    },

    /**
     * Find member on prototype chain beginning with super class.
     * @param {string} memberName
     * @returns {undefined|*} `undefined` if not found; value otherwise.
     */
    superMember: function(memberName) {
        var parent = this.super;
        do { parent = Object.getPrototypeOf(parent); } while (!parent.hasOwnProperty(memberName));
        return parent && parent[memberName];
    },

    /**
     * Find method on prototype chain beginning with super class.
     * @param {string} methodName
     * @returns {function}
     */
    superMethod: function(methodName) {
        var method = this.superMember(methodName);
        if (typeof method !== 'function') {
            throw new TypeError('this.' + methodName + ' is not a function');
        }
        return method;
    },

    /**
     * Find method on prototype chain beginning with super class and call it with remaining args.
     * @param {string} methodName
     * @returns {*}
     */
    callSuperMethod: function(methodName) {
        return this.superMethod(methodName).apply(this, Array.prototype.slice.call(arguments, 1));
    }
};
Base.extend = extend;
extend.Base = Base;

/**
 * Optional static method is called with new "class" (constructor) after extending.
 * This permits miscellaneous tweaking and cleanup of the new class.
 * @method postExtend
 * @param {object} prototype
 * @memberOf Base
 */

/** @typedef {function} extendedConstructor
 * @property prototype.super - A reference to the prototype this constructor was extended from.
 * @property [extend] - If `prototypeAdditions.extendable` was truthy, this will be a reference to {@link extend.extend|extend}.
 */

/** @typedef {object} prototypeAdditionsObject
 * @desc All members are copied to the new object. The following have special meaning.
 * @property {function} [initialize] - Additional constructor code for new object. This method is added to the new constructor's prototype. Gets passed new object as context + same args as constructor itself. Called on instantiation after similar function in all ancestors called with same signature.
 * @property {function} [preInitialize] - Called before the `initialize` cascade. Gets passed new object as context + same args as constructor itself. If not defined here, the top-most (and only the top-most) definition found on the prototype chain is called.
 * @property {function} [postInitialize] - Called after the `initialize` cascade. Gets passed new object as context + same args as constructor itself. If not defined here, the top-most (and only the top-most) definition found on the prototype chain is called.
 */

/** @summary Call all `initialize` methods found in prototype chain, beginning with the most senior ancestor's first.
 * @desc This recursive routine is called by the constructor.
 * 1. Walks back the prototype chain to `Object`'s prototype
 * 2. Walks forward to new object, calling any `initialize` methods it finds along the way with the same context and arguments with which the constructor was called.
 * @private
 * @memberOf extend-me
 */
function initializePrototypeChain() {
    var term = this,
        args = arguments;
    recur(term);

    function recur(obj) {
        var proto = Object.getPrototypeOf(obj);
        if (proto.constructor !== Object) {
            recur(proto);
            if (proto.hasOwnProperty('initialize')) {
                proto.initialize.apply(term, args);
            }
        }
    }
}

function getClassName() {
    return (
        this.prototype.$$CLASS_NAME ||
        this.prototype.name ||
        this.name // try Function.prototype.name as last resort
    );
}

function parentConstructor(ancestorConstructorName) {
    var prototype = this.prototype;
    if (prototype) {
        do {
            prototype = Object.getPrototypeOf(prototype);
        } while (ancestorConstructorName && prototype && prototype.constructor.name !== ancestorConstructorName);
    }
    return prototype && prototype.constructor;
}

module.exports = extend;
