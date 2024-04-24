import { Card, CardContent, CardHeader, CardTitle } from "@mattrax/ui";
import { A } from "@solidjs/router";
import { Suspense, type JSX } from "solid-js";
import Counter, { createCounter } from "./Counter";
import { Switch } from "solid-js";
import { Match } from "solid-js";

export function StatItem(
	props: {
		title: string;
		href: string;
		icon: JSX.Element;
	} & (
		| {
				value: number;
		  }
		| {
				body: JSX.Element;
		  }
	),
) {
	return (
		<Card class="relative hover:shadow-md transition-shadow">
			<CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
				<CardTitle class="text-sm font-medium">
					<span class="hover:underline">{props.title}</span>
				</CardTitle>

				{props.icon}
			</CardHeader>
			<CardContent>
				<div class="text-2xl font-bold">
					<Switch>
						<Match when={"value" in props && props} keyed>
							{(props) => {
								const counter = createCounter(() => ({
									value: props.value,
									duration: 1700,
								}));

								return (
									<dd class="mt-1 text-3xl font-semibold tracking-tight relative">
										<Suspense
											fallback={
												<>
													<span class="opacity-0">0</span>
													<div class="w-12 bg-neutral-200 animate-pulse absolute inset-y-0 rounded-full" />
												</>
											}
										>
											{counter().toLocaleString()}
										</Suspense>
									</dd>
								);
							}}
						</Match>
						<Match when={"body" in props && props} keyed>
							{(props) => props.body}
						</Match>
					</Switch>
				</div>
			</CardContent>
			<A class="absolute inset-0" href={props.href} />
		</Card>
	);
}
