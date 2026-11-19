
import { Construction } from 'lucide-react';
import Can from '../../features/auth/Can';

type ModulePlaceholderProps = {
  title: string;
  description: string;
};

export default function ModulePlaceholder({
  title,
  description,
}: ModulePlaceholderProps) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
      <div className="mb-5 inline-flex rounded-xl bg-blue-50 p-3 text-blue-600">
        <Construction size={24} />
      </div>

      <h2 className="text-2xl font-bold text-slate-900">
        {title}
      </h2>

      <p className="mt-3 max-w-xl text-slate-500">
        {description}
      </p>

      <p className="mt-6 text-sm font-medium text-blue-600">
        Module under development
      </p>

{title === 'Products' && (
  <div className="mt-6">
    <Can
      permission="products:create"
      fallback={
        <p className="text-sm text-slate-500">
          You have read-only access to products.
        </p>
      }
    >
      <p className="text-sm font-medium text-blue-600">
        Your role allows you to create products.
      </p>
    </Can>
  </div>
)}

{title === 'Inventory' && (
  <div className="mt-6">
    <Can
      permission="inventory:manage"
      fallback={
        <p className="text-sm text-slate-500">
          You can view inventory, but cannot record stock movements.
        </p>
      }
    >
      <p className="text-sm font-medium text-blue-600">
        Your role allows you to manage stock movements.
      </p>
    </Can>
  </div>
)}

{title === 'Reports' && (
  <div className="mt-6">
    <Can
      permission="reports:cost"
      fallback={
        <p className="text-sm text-slate-500">
          Cost-sensitive reports are restricted for your role.
        </p>
      }
    >
      <p className="text-sm font-medium text-blue-600">
        Your role allows access to cost-sensitive reports.
      </p>
    </Can>
  </div>
)}
    </section>
  );
}
