import { describe, expect, it } from 'vitest';
import { createGradeShader, resolvePassPlan } from './postFx.js';
import { BUDGETS } from './qualityTier.js';

describe('resolvePassPlan', () => {
	it('always renders first and outputs last', () => {
		const plan = resolvePassPlan({ ssao: true, bloom: true, dof: true, grade: true });
		expect(plan[0]).toBe('render');
		expect(plan.at(-1)).toBe('output');
	});

	it('reads depth before anything blurs the buffer', () => {
		const plan = resolvePassPlan({ ssao: true, bloom: true, dof: true, grade: true });
		expect(plan.indexOf('ssao')).toBeLessThan(plan.indexOf('dof'));
		expect(plan.indexOf('dof')).toBeLessThan(plan.indexOf('bloom'));
		expect(plan.indexOf('bloom')).toBeLessThan(plan.indexOf('grade'));
	});

	it('is a bare render for the low tier', () => {
		expect(resolvePassPlan(BUDGETS.low)).toEqual(['render', 'output']);
	});

	it('gives mid contact shadows and bloom but no grain or bokeh', () => {
		expect(resolvePassPlan(BUDGETS.mid)).toEqual(['render', 'ssao', 'bloom', 'output']);
	});

	it('gives high the full chain', () => {
		expect(resolvePassPlan(BUDGETS.high)).toEqual([
			'render',
			'ssao',
			'dof',
			'bloom',
			'grade',
			'output'
		]);
	});

	it('defaults to a plain render for an empty budget', () => {
		expect(resolvePassPlan()).toEqual(['render', 'output']);
	});
});

describe('createGradeShader', () => {
	it('returns fresh uniform objects so two composers never share state', () => {
		const a = createGradeShader();
		const b = createGradeShader();
		expect(a.uniforms).not.toBe(b.uniforms);
		a.uniforms.uTime.value = 5;
		expect(b.uniforms.uTime.value).toBe(0);
	});

	it('declares every uniform its fragment shader samples', () => {
		const shader = createGradeShader();
		for (const name of ['tDiffuse', 'uTime', 'uGrain', 'uVignette', 'uAberration']) {
			expect(shader.uniforms).toHaveProperty(name);
			expect(shader.fragmentShader).toContain(name);
		}
	});
});
