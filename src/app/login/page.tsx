import { Flash } from "../../components/Flash";
import { loginAction } from "../actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; notice?: string }>;
}) {
  const flash = await searchParams;
  return (
    <main>
      <h1>Operator sign-in</h1>
      <p className="lede">Enter the ops access token from the server environment. It is not stored in the repo.</p>
      <Flash error={flash.error} notice={flash.notice} />
      <form className="stack" action={loginAction}>
        <label>Token<input name="token" type="password" required /></label>
        <button type="submit">Continue</button>
      </form>
    </main>
  );
}
