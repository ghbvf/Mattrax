import { type JSX, Show, Suspense } from "solid-js";
import { createCounter } from "~/components/Counter";
import { Page } from "~/components/Page";
import { useTenantStats } from "~/lib/data";

export default function () {
	const stats = useTenantStats();

	return (
		<Page breadcrumbs={[]} class="p-4">
			<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
				<StatItem
					title="Devices"
					icon={<IconPhDevices />}
					value={stats.data?.devices || 0}
				/>
				<StatItem
					title="Blueprints"
					icon={<IconPhScroll />}
					value={stats.data?.blueprints || 0}
				/>
			</div>
		</Page>
	);
}

function StatItem(props: { title: string; icon: JSX.Element; value: number }) {
	return (
		<div class="rounded-xl border bg-card text-card-foreground shadow">
			<div class="p-6 flex flex-row items-center justify-between space-y-0 pb-2">
				<h3 class="tracking-tight text-sm font-medium">{props.title}</h3>
				{props.icon}
			</div>
			<div class="p-6 pt-0">
				<div class="text-2xl font-bold">
					<Suspense>
						<Show when={props.value !== undefined} keyed>
							{(value) => {
								const counter = createCounter(() => ({
									value: props.value!,
									duration: 1000,
								}));

								return <>{counter().toLocaleString()}</>;
							}}
						</Show>
					</Suspense>
				</div>
				{/* <p class="text-xs text-muted-foreground">+20.1% from last month</p> */}
			</div>
		</div>
	);
}
