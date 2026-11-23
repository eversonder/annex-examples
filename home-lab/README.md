# Your agents on a machine of your own

Run sandboxes on a Mac mini, a Linux server or a Raspberry Pi you own, at $0 an hour, with your cloud accounts taking over when it is full. Every other example in this repository then runs at home without changing a line.

## Connect the machine

1. In the Annex dashboard, open **Connections** and choose **Your own server**. Only the workspace's owner can.
2. Run the one command it shows on the machine. It installs a small helper that connects out to Annex; nothing on the machine is opened to the internet.
3. The machine appears as a connection with a rate of $0 an hour and a limit on how many sandboxes it runs at once.

A Linux machine needs a 64-bit system; a Mac needs Apple silicon and macOS 26 or later.

## See it spill over

```sh
node spill.mjs 6
```

It starts six small sandboxes with the route `cheapest` and prints where each landed. Your machine costs nothing, so it is chosen first; once it is at its limit the rest go to your next-cheapest account.

## Then

Run any other example. `route: cheapest` in their templates now means "at home first".
