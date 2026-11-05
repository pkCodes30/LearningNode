// WrapperType<T> is just T for TypeScript. But because it's a generic alias, the compiler writes
// `Object` (not the class) into the decorator metadata, so the class isn't touched while the file
// is still loading. Needed for circular imports in ESM projects (see notes/10 §5).
export type WrapperType<T> = T;
