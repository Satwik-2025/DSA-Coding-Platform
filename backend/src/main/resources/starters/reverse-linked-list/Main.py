import sys


class ListNode:
    def __init__(self, val, next=None):
        self.val = val
        self.next = next


def solve(head):
    # Reverse the list in place and return the new head (None for an empty list).
    # TODO: write your algorithm here
    return head


def main():
    data = sys.stdin.buffer.read().split()
    n = int(data[0])
    dummy = tail = ListNode(0)
    for x in data[1:1 + n]:
        tail.next = ListNode(int(x))
        tail = tail.next
    node = solve(dummy.next)
    parts = []
    # Stop after n nodes: a reversal that leaves a cycle would otherwise print forever.
    for _ in range(n):
        if node is None:
            break
        parts.append(f"{node.val} -> ")
        node = node.next
    print("".join(parts) + "null" if node is None else "ERROR: more nodes than the input had (cycle?)")


main()
